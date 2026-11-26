# Plan 003: Free backend, sync and push reminders

| Field   | Value                                                 |
| ------- | ----------------------------------------------------- |
| Status  | Proposed                                              |
| Author  | naipei                                                |
| Created | 2026-11-26                                            |
| Updates | Plan 001, section 8 (Stage 2) and Plan 002, section 6 |

## 1. Summary

Make Routine Builder usable on a phone, with reminders that arrive while the app is
closed, for **$0**. The app becomes an installable PWA, and a Cloudflare Worker provides
the API, the database (D1) and a scheduler that runs every minute and sends Web Push
notifications.

This replaces the Stage 2 stack in Plan 001 (NestJS, PostgreSQL, BullMQ on an always-on
server), which cannot run on a free tier.

## 2. Requirements

1. Reminders reach the phone while the app is closed, on Android and iPhone.
2. The same routines on phone and laptop.
3. **Every service on a free tier.** No paid hosting, database, scheduler or email.
4. Nothing that falls asleep or pauses, since a sleeping server misses reminders.

## 3. How a reminder reaches the phone

Web Push. The browser vendors' push services (Google for Chrome and Android, Apple for
Safari and iOS, Mozilla for Firefox) deliver messages to devices for free.

1. The user taps **Turn on reminders**. The service worker subscribes and the browser
   returns a push subscription (an endpoint URL plus keys) for this device.
2. The app sends the subscription to our API, which stores it.
3. Each minute, the scheduler finds due reminders and sends an encrypted message, signed
   with our VAPID key, to each of the user's subscriptions.
4. The push service wakes the device. Our service worker shows the notification, even
   with the app closed.

| Platform                | Support                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| Android (Chrome, Edge…) | Works from the browser or the installed app                          |
| iPhone and iPad         | iOS 16.4+, and only after **Add to Home Screen**; asked once per app |
| Desktop browsers        | Works while the browser is running                                   |

Consequences for the client:

- The app must be a **PWA**: web app manifest, icons and a service worker.
- Notifications are shown with `registration.showNotification()` from the service
  worker. `new Notification()` (used by the current in-tab reminders) throws on Android.
- On iPhone, the "Turn on reminders" button only appears in the installed app, with
  instructions to add it to the Home Screen when opened in Safari.

## 4. Why Cloudflare

Free tiers that sleep or pause cannot send a reminder at 07:10:

| Option (free tier)            | Problem                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| Vercel Hobby functions + cron | Scheduled jobs documented as once a day (newer docs: every 15 min)   |
| Render free web service       | Sleeps after 15 minutes idle; keep-alive pings are against its terms |
| Supabase free                 | Project pauses after a week of low activity                          |
| NestJS + BullMQ               | Needs an always-on server and Redis, which is not free               |

Cloudflare Workers never sleep, and the free plan includes everything needed:

| Need      | Cloudflare (free plan)                         | Our expected use            |
| --------- | ---------------------------------------------- | --------------------------- |
| API       | Workers, 100,000 requests a day                | Hundreds a day              |
| Scheduler | Cron Triggers, 5 per account, every minute     | 1 trigger, 1,440 runs a day |
| Database  | D1 (SQLite), 500 MB per database, 5M reads/day | Kilobytes                   |
| Website   | Static assets served by the same Worker        | The existing Vite build     |

**Is relational data the right fit?** Yes. Users, routines, activities, completions and
push subscriptions are small, structured and linked, and the key query, "which
reminders are due now across all users", is an indexed range scan on one column. D1 is
SQLite, so it is relational, and Drizzle ORM gives typed queries and migrations.

**Alternative kept in reserve:** Vercel functions + Neon Postgres (free, 1 GB) + Upstash
QStash (free, 1,000 messages a day, 7-day max delay) to trigger each reminder. Also
free, but three accounts instead of one and more moving parts.

## 5. Architecture

```
routine-builder/
├── apps/
│   ├── web/          React PWA (existing) + service worker
│   └── api/          Cloudflare Worker: Hono API, cron scheduler, static assets
├── packages/
│   ├── domain/       Shared schemas and logic, now time-zone aware
│   ├── db/           Drizzle schema and D1 migrations
│   └── ui/           shadcn components (existing)
```

**One origin for app and API.** The Worker serves the built web app and the API under
`/api` on the same domain. Session cookies stay first-party, which Safari requires
(it blocks third-party cookies), and no CORS setup is needed. This moves hosting from
Vercel to Cloudflare; Vercel was never deployed, so nothing is lost.

**Shared domain package.** The API validates input with the same Zod schemas as the web
app, and computes reminder times with the same logic. The current time helpers build
dates in the _runtime's_ local time zone; on the server they must take the user's IANA
time zone (for example `Africa/Nairobi`). Section 7 covers this change.

## 6. Data model (D1)

| Table                | Key columns                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | `id`, `email` (unique), `time_zone`, `created_at`                                                                                         |
| `login_codes`        | `email`, `code_hash`, `expires_at`, `attempts`                                                                                            |
| `sessions`           | `id_hash`, `user_id`, `expires_at`                                                                                                        |
| `routines`           | `id`, `user_id`, `name`, `days`, `enabled`, `created_at`, `updated_at`                                                                    |
| `activities`         | `id`, `routine_id`, `position`, `title`, `time`, `duration_minutes`, `notes`, `reminder_minutes_before`, **`next_reminder_at`** (indexed) |
| `completions`        | (`user_id`, `routine_id`, `activity_id`, `date`) primary key, `completed_at`                                                              |
| `push_subscriptions` | `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `created_at`, `last_success_at`                                                   |

- `next_reminder_at` is the next UTC instant this activity's reminder should fire, or
  `null` when it has no reminder or its routine is off. It is recomputed whenever the
  activity, its routine, or the user's time zone changes, and after each send.
- Session ids and login codes are stored hashed, so a database leak does not leak
  sessions.

## 7. Scheduler

A Cron Trigger runs `scheduled()` every minute:

1. Select activities where `next_reminder_at <= now`, oldest first, in batches.
2. For each one, claim it with a conditional update that moves `next_reminder_at` to
   the following occurrence: `UPDATE … WHERE id = ? AND next_reminder_at = ?`. If no
   row changes, another run already claimed it, so overlapping runs cannot double-send.
3. Skip sending if the reminder is more than 5 minutes late (the same grace window as
   Plan 001) or the activity is already marked done for that day.
4. Send the push to each of the user's subscriptions. Delete subscriptions the push
   service reports as gone (HTTP 404 or 410).

**Time zones.** "Next occurrence" means: the next date the routine runs, at the
activity's wall-clock time, in the user's time zone, minus the reminder lead. The domain
package gains a function that converts a wall-clock date and time in a named time zone
to a UTC instant, tested across daylight-saving changes. The web app reports
`Intl.DateTimeFormat().resolvedOptions().timeZone` at sign-in and when it changes.

**CPU budget.** Free Workers get 10 ms of CPU per invocation; time spent waiting on the
network or database does not count. Encrypting and signing each push is the main CPU
cost. At personal scale (a few reminders a minute at most) this fits; if it ever does
not, sends move to a queue or are spread across invocations.

**Web Push library.** The common `web-push` package needs Node's crypto and does not run
on Workers. Use a Web Crypto-based library (PushForge or similar, chosen in the push PR
after checking maintenance), with the VAPID private key stored as a Worker secret.

## 8. Sign-in

Email with a **6-digit code typed into the app**, not a magic link. On iPhone, an
installed web app does not share cookies with Safari, so a link tapped in an email would
sign the user in to Safari instead of the app.

- Codes expire after 10 minutes, are single use, and allow 5 attempts.
- The session is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie lasting 90 days.
- Email is sent with Resend's free plan (3,000 a month, 100 a day).

**Free-tier limit to know about:** without a verified custom domain, Resend only
delivers to the account owner's own address. That is enough to run the app for
yourself. Inviting other people needs either a domain (a small yearly cost) or a
different sign-in method; see open questions.

## 9. Sync

- The server is the source of truth for signed-in users. A new `ApiRepository`
  implements the existing `RoutineRepository` interface, so pages do not change.
- `localStorage` stays as a cache so the app opens instantly and shows the last data
  when offline. Editing requires a connection in this version.
- Concurrent edits from two devices: last write wins per routine, using `updatedAt`.
- On first sign-in, routines already in the browser are uploaded, so nothing created
  before sign-in is lost.
- Signed-out use keeps working exactly as today, with in-tab reminders. When a device
  has a push subscription, in-tab reminders turn off to avoid duplicates.

## 10. Delivery

| PR  | Branch               | Contents                                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `feat/pwa`           | Manifest, icons, service worker, install prompt help; notifications via the service worker |
| 2   | `chore/api-scaffold` | `apps/api` Worker with Hono, `packages/db` with Drizzle and D1, local dev, CI, deploy      |
| 3   | `feat/auth`          | Email code sign-in, sessions, sign-out                                                     |
| 4   | `feat/sync`          | Routines and completions API, `ApiRepository`, upload local data on first sign-in          |
| 5   | `feat/push`          | Time-zone-aware next occurrence, subscriptions API, cron scheduler, Web Push               |

PR 1 is useful on its own: the app becomes installable on a phone with the current
browser-only data, and the deploy moves to Cloudflare.

## 11. Risks

| Risk                                                        | Mitigation                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Free-tier terms change                                      | Logic lives in `packages/domain`; Plan B (Vercel + Neon + QStash) is documented |
| 10 ms CPU limit with many reminders in one minute           | Batch sends, measure in production, move to a queue if needed                   |
| iPhone users never install the app, so no push              | Clear "Add to Home Screen" steps; in-app reminders still work                   |
| Push services delay delivery while a phone is in deep sleep | Send with high urgency; accept small delays                                     |
| Email codes only reach the owner without a custom domain    | Fine for personal use; revisit before inviting others                           |

## 12. Open questions

1. Before inviting other users: buy a domain for email, or add "Sign in with Google" or
   passkeys (both free)? Each needs testing inside an installed iPhone app.
2. Should completions sync immediately or in batches when the phone is offline?
3. Should reminder history (sent, clicked) be stored, for streaks and debugging?

## Sources

- Apple: [Sending web push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
  WebKit: [Web Push for web apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados)
- Cloudflare: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
  [D1 limits](https://developers.cloudflare.com/d1/platform/limits)
- Vercel: [Cron jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- Render: [Free instances](https://render.com/docs/free)
- Supabase: [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- Neon: [Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas),
  Upstash: [QStash pricing](https://upstash.com/pricing/qstash)
- Resend: [Account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- WebKit bug 181849: [Home Screen apps don't share storage with Safari](https://bugs.webkit.org/show_bug.cgi?id=181849)
- PushForge: [Web Push for edge runtimes](https://github.com/draphy/pushforge)
