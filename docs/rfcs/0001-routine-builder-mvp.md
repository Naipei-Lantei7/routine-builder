# RFC 0001: Routine Builder MVP and Reminders

| Field   | Value                                 |
| ------- | ------------------------------------- |
| Status  | Draft                                 |
| Author  | naipei                                |
| Created | 2026-11-26                            |
| Scope   | MVP (client only) + Stage 2 (backend) |

## 1. Summary

Routine Builder is a web app for building daily routines and schedules. A user
creates routines ("Weekday morning", "Gym days"), picks the days of the week
each one applies to, and adds timed activities ("07:30 Stretch", "08:00 Leave
for work"). The app shows today's activities in time order, lets the user tick
them off, and reminds them before each activity starts.

This RFC defines the MVP, which runs entirely in the browser, and the path to a
later backend that delivers reminders even when the app is closed.

## 2. Motivation

- Most to-do apps are about one-off tasks. Routines repeat, so the user should
  define them once and see the right activities each day without re-entering
  them.
- A schedule only helps if the user is told when something is due. Reminders
  are the core feature, not an extra.
- The project is also a portfolio piece. It should show a clean, tested
  TypeScript codebase, a PR-based workflow, and a credible path from a
  client-only app to a full-stack one.

## 3. Goals and non-goals

### Goals (MVP)

1. Create, edit, and delete routines.
2. Each routine has a name, the days of the week it runs on, and an ordered
   list of activities.
3. Each activity has a start time (`HH:mm`), a title, an optional duration,
   optional notes, and an optional reminder (N minutes before).
4. A **Today** view that merges the activities of every routine active today,
   sorted by time, with a way to mark each one done.
5. Browser reminders while the app is open in a tab.
6. Data persists across reloads in `localStorage`, validated on load.
7. Deployed publicly with CI on every PR.

### Non-goals (MVP)

- Accounts, sync between devices, or any server.
- Reminders while the app is closed (that is Stage 2, section 8).
- Streaks, history, and statistics (planned follow-up, section 10).
- One-off events, calendar integration, or recurrence rules beyond "these days
  of the week".
- Native mobile apps.

## 4. User stories

- As a user, I create a "Weekday morning" routine for Monday to Friday with
  "07:00 Wake up", "07:15 Stretch (10 min)", and "08:00 Leave", each with a
  5-minute reminder.
- As a user, I open the app and see only what applies today, in order, with
  the next upcoming activity highlighted.
- As a user, I get a notification at 07:10 saying "Stretch starts in 5 min".
- As a user, I tick "Stretch" done, and it stays done if I reload the page,
  but it is unticked again tomorrow.
- As a user who denied notification permission, I still see an in-app banner
  when an activity is due.

## 5. Design

### 5.1 Stack

| Concern    | Choice                                  | Why                                               |
| ---------- | --------------------------------------- | ------------------------------------------------- |
| UI         | React + TypeScript + Vite               | Familiar, fast to build, typed end to end         |
| Validation | Zod                                     | One schema gives both runtime checks and TS types |
| Tests      | Vitest (+ Testing Library for UI)       | Native to Vite, fast                              |
| Lint       | oxlint (from the Vite template) + Prettier | Kept the template default rather than adding ESLint |
| CI         | GitHub Actions: format, lint, typecheck, test, build | Every PR proves it works                |
| Hosting    | Vercel                                  | Free, preview deploy per PR                       |

### 5.2 Architecture

All business logic lives in plain TypeScript modules with no React imports.
Components call into them. This keeps the logic unit-testable and lets the
same code move to the backend in Stage 2.

```
src/
  domain/          # pure TS, no React, no browser APIs
    schema.ts      # Zod schemas + inferred types
    routines.ts    # create/update/reorder/delete helpers
    schedule.ts    # "what is on today", sorting, next-up
    reminders.ts   # compute reminder instants, decide what is due
    time.ts        # HH:mm parsing, local date keys
  storage/
    repository.ts  # RoutineRepository interface
    localStorageRepository.ts
    migrations.ts
  notifications/
    notifier.ts    # Notification API + in-app fallback
    scheduler.ts   # the tick loop (browser side effects live here)
  ui/
    pages/         # RoutineList, RoutineEditor, Today
    components/
```

Storage sits behind a `RoutineRepository` interface. In Stage 2 a second
implementation talks to the API, and the UI does not change.

### 5.3 Data model

```ts
// Days use ISO numbering: 1 = Monday ... 7 = Sunday.
const Weekday = z.number().int().min(1).max(7);

// Wall-clock local time, e.g. "07:30". Not a timestamp.
const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const Activity = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  time: TimeOfDay,
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  notes: z.string().max(500).optional(),
  reminderMinutesBefore: z.number().int().min(0).max(24 * 60).nullable(), // null = no reminder
});

const Routine = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  days: z.array(Weekday).min(1),
  activities: z.array(Activity),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// One record per activity per day it was completed.
const Completion = z.object({
  routineId: z.string().uuid(),
  activityId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // local date key
  completedAt: z.string().datetime(),
});

const AppState = z.object({
  version: z.literal(1),
  routines: z.array(Routine),
  completions: z.array(Completion),
  firedReminders: z.array(z.string()), // keys, see 5.6
});
```

Decisions:

- **Times are wall-clock strings, not timestamps.** "07:30" means 07:30 in
  whatever time zone the user is in today. This is what people mean by a
  routine, and it handles travel and daylight saving without conversion.
- **Activities are kept in the order the user arranged them**, but the Today
  view sorts by `time`. The editor offers "sort by time" as a one-click
  action rather than forcing it, so two activities at the same time keep the
  user's order.
- **Completions are separate from routines.** Editing a routine never loses
  history, and streaks can later be computed from completions alone.
- **Deleting an activity or routine keeps its completions.** They are ignored
  by the Today view and will feed history later.

### 5.4 Storage

- One `localStorage` key, `routine-builder:v1`, holding the whole `AppState`
  as JSON. Data is small (well under the ~5 MB limit), so a single document
  is simpler than one key per routine.
- On load: parse JSON, run migrations based on `version`, then validate with
  Zod.
- If parsing or validation fails, the app does **not** overwrite the stored
  value. It copies the raw string to `routine-builder:corrupt:<timestamp>`,
  starts with empty state, and shows a notice. This avoids silently destroying
  user data because of a bug.
- Writes are synchronous after each change. A `storage` event listener reloads
  state when another tab changes it.
- Completions older than 400 days are pruned on load to bound growth.

### 5.5 Today view logic

`getTodaysActivities(routines, now)` in `domain/schedule.ts`:

1. Compute today's ISO weekday and local date key from `now`.
2. Take enabled routines whose `days` include today.
3. Flatten their activities, tagging each with its routine.
4. Sort by `time`, then routine name, then original index.
5. Join with today's completions to get `done`.
6. Mark the first not-done activity whose start time has not passed by more
   than its duration (or 15 minutes if no duration) as **next up**.

`now` is always passed in, never read inside the function, so tests can use
fixed dates, including daylight-saving transition days.

### 5.6 Reminders (MVP, in-tab)

The browser has no reliable API for scheduling a notification in the future
from a web page. (Notification Triggers was abandoned; Periodic Background
Sync is Chromium-only, needs an installed PWA, and has no timing guarantee.)
So in the MVP, reminders fire only while a tab is open.

**Scheduler: a tick loop, not one timer per reminder.** Long `setTimeout`
calls drift and are throttled in background tabs, and laptops sleep. Instead,
`scheduler.ts` runs `checkDueReminders()` every 30 seconds, plus immediately
on `visibilitychange` and `focus`.

`getDueReminders(routines, now, firedKeys)` in `domain/reminders.ts`:

1. For today and tomorrow, compute each activity's reminder instant:
   activity start (local date + `time`) minus `reminderMinutesBefore`. Looking
   at tomorrow catches an activity at 00:05 whose reminder falls at 23:55
   today.
2. A reminder is **due** if `instant <= now` and `now - instant <= 5 min`
   (the grace window).
3. Skip it if its key, `${routineId}:${activityId}:${date}`, is already in
   `firedKeys`, or if the activity is already marked done.

After showing a reminder, its key is added to `firedReminders` and saved, so
reloads and multiple tabs do not repeat it. Keys older than two days are
pruned.

**Missed reminders.** If the tab was closed or the laptop asleep past the
grace window, the reminder is not shown late as a notification. The Today
view shows the activity as overdue instead. This prevents a burst of stale
notifications when the user opens the laptop.

**Multiple tabs.** Two tabs could both see a reminder as due in the same
tick. Use the Web Locks API (`navigator.locks.request("reminders", ...)`)
around check-and-mark so only one tab fires it. If Web Locks is missing,
accept a rare duplicate.

**Delivery** (`notifier.ts`):

- If `Notification.permission === "granted"`: show a system notification
  ("Stretch in 5 min", body = routine name). Clicking it focuses the tab and
  scrolls to the activity.
- Otherwise: show an in-app banner and play no sound.
- Permission is requested only after a user action, from a "Turn on
  reminders" button in the Today view, never on page load. Browsers block or
  penalise unprompted requests.
- If permission is `denied`, the button explains how to re-enable it in
  browser settings.

The UI states plainly: "Reminders work while this tab is open."

### 5.7 Accessibility and UX

- Every action is reachable by keyboard; reordering uses up/down buttons
  (drag and drop can be added later on top).
- Time inputs use `<input type="time">`.
- Respect `prefers-color-scheme` and `prefers-reduced-motion`.
- The Today view works at phone width, since that is where people check
  their schedule.

## 6. Testing

- **Domain:** unit tests for every function in `domain/`, using fixed `now`
  values. Required cases: activity at midnight boundaries, reminder crossing
  into the previous day, a DST start day, a routine with no activities, two
  activities at the same time, already-fired and already-done reminders.
- **Storage:** valid round trip, invalid JSON, schema-invalid data (must be
  backed up, not overwritten), migration from an older version.
- **Scheduler:** fake timers with Vitest; assert one notification per
  reminder across ticks and reloads.
- **UI:** Testing Library tests for create routine, add/reorder/delete
  activity, mark done.
- CI blocks merging if any check fails.

## 7. Delivery plan

One branch and one PR per item, Conventional Commits, squash-merge into
`main`.

| PR | Branch                | Contents                                                                 |
| -- | --------------------- | ------------------------------------------------------------------------ |
| 0  | `docs/rfc-0001`       | This RFC                                                                 |
| 1  | `chore/setup`         | Vite + React + TS, oxlint, Prettier, Vitest, GitHub Actions              |
| 2  | `feat/routine-model`  | Zod schemas, time helpers, repository, migrations, tests                 |
| 3  | `feat/routine-editor` | Routine list, create/edit form, add/reorder/delete activities, tests     |
| 4  | `feat/today-view`     | Today view, next-up, mark done, completions, tests                       |
| 5  | `feat/reminders`      | Reminder logic, tick scheduler, Notification API + banner fallback, tests |
| 6  | `docs/readme-deploy`  | README with screenshots, Vercel deploy, live link                        |

PRs 2 and 4 are pure logic and should carry most of the tests. PR 6 can be
done right after PR 3 so there is a live link early, then redeployed
automatically as later PRs merge.

## 8. Stage 2: reminders when the app is closed

Real reminders need a server that knows the schedule and pushes to the
device at the right time.

### Components

- **API:** NestJS + PostgreSQL (via Prisma or TypeORM). Users, routines,
  activities, completions, push subscriptions.
- **Auth:** email magic link or OAuth. Each user stores an IANA time zone
  (e.g. `Africa/Nairobi`), defaulting to the browser's.
- **Scheduler:** BullMQ on Redis. For each activity with a reminder, enqueue
  a delayed job for its next occurrence. When the job runs, it sends the push
  and enqueues the following occurrence.
- **Delivery:** Web Push with VAPID keys. The front end registers a service
  worker, subscribes with `PushManager`, and posts the subscription to the
  API. The service worker's `push` handler shows the notification.

### Key decisions

- **Next-occurrence jobs, not a pre-generated calendar.** Only one pending
  job per activity at any time. Editing or deleting an activity removes its
  job by a deterministic job ID (`reminder:<activityId>`) and enqueues a
  new one.
- **Time zone math on the server** with a real tz library (Luxon or
  `date-fns-tz`), since wall-clock `07:30` must be converted to a UTC instant
  per occurrence, and DST changes that offset.
- **A reconciliation job** runs every few minutes and re-enqueues any
  missing jobs, so a Redis restart or a bug cannot silently drop reminders.
- **Expired subscriptions** (push service returns 404 or 410) are deleted.
- **Migration from the MVP:** on first sign-in, the client uploads its
  `localStorage` state; the server validates it with the same Zod schemas
  (shared package) and imports it.

### Platform caveat

On iOS and iPadOS, web push only works when the app is added to the Home
Screen (iOS 16.4+). The app should become an installable PWA (manifest +
service worker) as part of Stage 2 and explain this to iPhone users.

## 9. Alternatives considered

| Option                                         | Why not (for now)                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| One `setTimeout` per reminder                  | Drifts, throttled in background tabs, lost on sleep                  |
| Notification Triggers API                      | Experiment was abandoned; not available                              |
| Periodic Background Sync                       | Chromium-only, installed PWA only, browser decides timing            |
| IndexedDB instead of `localStorage`            | More complex; data is small. Revisit if history grows large          |
| Firebase / Supabase instead of NestJS          | Faster, but the goal is to show backend skills with a familiar stack |
| Cron-style polling of all users every minute   | Simple, but scales poorly; delayed jobs are precise and per-activity |
| Storing activity times as UTC timestamps       | Breaks on travel and DST; routines are wall-clock by nature          |

## 10. Future work

- Streaks and history, computed from completions.
- A countdown timer for activities with a duration.
- "Skip today" for a single routine.
- Snooze on a reminder.
- Templates (morning routine, push/pull/legs).
- Export and import as JSON.

## 11. Open questions

1. Should an activity be allowed in more than one routine, or is copying
   enough? (Proposal: copying is enough for the MVP.)
2. Should the Today view let a user tick off an activity from a routine that
   does not run today? (Proposal: no; add "Skip today" / "Do today" later.)
3. Default reminder lead time for new activities: none, 0 minutes, or 5?
   (Proposal: 5 minutes, easy to turn off.)
4. For Stage 2, is email a needed fallback channel when push is unavailable?
