# Routine Builder

Plan your day as routines, see what's on today, and get reminded before each activity.

**Live app:** [routine-builder.naipei.workers.dev](https://routine-builder.naipei.workers.dev)
(installable on your phone; see [Install it on your phone](#install-it-on-your-phone)).

Create routines like "Weekday morning" or "Push day", choose the days they run, and add
activities at set times. The **Today** view merges everything scheduled for today in time
order, highlights what's next, and lets you tick things off. Reminders arrive as browser
notifications a few minutes before each activity.

<p align="center">
  <img src="docs/screenshots/today-light.png" alt="Today view: activities in time order, five done, the current one marked Now" width="32%" />
  <img src="docs/screenshots/routines-light.png" alt="Routine list: four routines with their days, activities and reminders" width="32%" />
  <img src="docs/screenshots/today-dark.png" alt="Today view in dark mode" width="32%" />
</p>

## Features

- **Routines on a schedule.** Each routine has a name, the days of the week it runs, and
  activities with a time, optional duration, notes and reminder.
- **Today view.** Every activity from today's routines in one list, with the next one
  highlighted ("Now" or "Next · in 25 min"), overdue ones marked, and a progress bar.
- **Reminders.** System notifications before an activity, from "at start time" to an hour
  before. They never repeat across reloads or tabs, and missed ones don't pile up later.
  If notifications are off, reminders appear on the page instead.
- **Editor.** Add, reorder, sort by time and remove activities, with errors shown next to
  the fields they belong to.
- **No account needed.** Data stays in your browser and is validated on every load. If
  stored data is ever unreadable, it is backed up instead of being overwritten.
- **Light and dark themes**, following your system setting or chosen in the header, and
  every action works from the keyboard.

## Tech stack

| Area      | Tools                                                                    |
| --------- | ------------------------------------------------------------------------ |
| App       | React 19, TypeScript (strict), Vite                                      |
| Routing   | TanStack Router with file-based routes                                   |
| UI        | shadcn/ui (Radix primitives) on Tailwind CSS v4, in a shared package     |
| Data      | Zod schemas as the single source of types and runtime validation         |
| Monorepo  | pnpm workspaces and Turborepo                                            |
| Quality   | Vitest, Testing Library, oxlint, Prettier                                |
| CI and CD | GitHub Actions on every pull request, Cloudflare (free plan) for hosting |

## Architecture

```
routine-builder/
├── apps/
│   ├── web/                 React app: routes, state, storage, notifications
│   └── api/                 Cloudflare Worker: Hono API under /api, serves the web app
├── packages/
│   ├── domain/              @routine-builder/domain: schemas and pure logic
│   ├── db/                  @routine-builder/db: Drizzle schema and D1 migrations
│   └── ui/                  @routine-builder/ui: shadcn components and theme
└── docs/plans/              Design plans written before each feature
```

- **`packages/domain`** holds the business rules as plain TypeScript functions: what's on
  today, which reminders are due, validating a routine. It has no React and no browser
  APIs (its tsconfig has no DOM types), so it is easy to test and can be reused by a
  server later.
- **`packages/ui`** holds the shadcn/ui components and theme tokens. Apps import components
  from it instead of writing one-off versions.
- **`apps/web`** wires them together: TanStack Router routes, a React context over a
  storage repository, and the reminder loop.
- **`apps/api`** is a single Cloudflare Worker that answers `/api/*` with a Hono app and
  serves the built web app for everything else, so both share one origin.
- **`packages/db`** holds the Drizzle schema for Cloudflare D1 (SQLite) and the SQL
  migrations generated from it.

A few decisions worth calling out:

- **Times are wall-clock strings** (`"07:30"`), not timestamps, because a routine means
  "07:30 wherever I am today". Logic tests run in a fixed time zone so daylight-saving
  days are covered.
- **Storage sits behind a repository interface.** The app uses `localStorage` today; a
  server-backed version can replace it without UI changes.
- **Reminders use a 30-second check loop, not one timer per reminder**, because long
  timers drift and stop while a laptop sleeps. A Web Lock makes sure only one open tab
  shows each reminder.

The full reasoning is in [Plan 001](docs/plans/001-routine-builder-mvp.md) (product and
design), [Plan 002](docs/plans/002-monorepo-and-shadcn.md) (monorepo and UI) and
[Plan 003](docs/plans/003-free-backend-and-push.md) (free backend and push reminders).

## Getting started

Requires Node 24 and pnpm 10. If you don't have pnpm, `corepack enable` installs the
version pinned in `package.json`.

```bash
git clone https://github.com/Naipei-Lantei7/routine-builder.git
cd routine-builder
pnpm install
pnpm dev          # app on http://localhost:5173, API on http://localhost:8787
```

`pnpm dev` starts Vite and the Worker together. Vite forwards `/api` requests to the
Worker, which uses a local SQLite file for D1 and applies migrations on start.

| Command                                      | What it does                                    |
| -------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                   | Start the app in development mode               |
| `pnpm check`                                 | Lint, typecheck, test and build every package   |
| `pnpm test`                                  | Run all tests                                   |
| `pnpm --filter @routine-builder/web dev`     | Run a command in one package                    |
| `pnpm format`                                | Format the repo with Prettier                   |
| `pnpm deploy:app`                            | Build the app, migrate D1 and deploy the Worker |
| `pnpm --filter @routine-builder/db generate` | Create a migration after changing the schema    |

## Testing

Business rules are tested as plain functions in `packages/domain`, including edge cases
such as reminders that fall before midnight and both daylight-saving days. The web app is
tested end to end with Testing Library: tests render the real router at a URL, use the
real storage, fix the clock, and stand in for the browser's Notification API.

## Install it on your phone

Routine Builder is a Progressive Web App: it installs like a regular app and opens
offline.

- **Android (Chrome, Edge, Samsung Internet):** open the site and tap **Install** on the
  Today page, or use the browser menu's **Install app**.
- **iPhone and iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
  Notifications on iOS only work from the installed app (iOS 16.4 or later).

## Deployment

Everything runs on Cloudflare's free plan as one Worker (`apps/api/wrangler.jsonc`): the
API under `/api`, the D1 database, and the built web app as static assets. Unknown paths
serve `index.html`, so links like `/routines` work on reload, and `apps/web/public/_headers`
sets caching: the service worker and manifest are always re-checked, hashed build files are
cached for a year.

One-time setup:

```bash
pnpm --filter @routine-builder/api exec wrangler login
pnpm --filter @routine-builder/api exec wrangler d1 create routine-builder
```

Copy the `database_id` it prints into `apps/api/wrangler.jsonc`. Then, for each release:

```bash
pnpm deploy:app   # builds the web app, applies new D1 migrations, deploys the Worker
```

## How this project is built

Each feature starts as a numbered plan in [`docs/plans`](docs/plans), then lands as small
pull requests with [Conventional Commits](https://www.conventionalcommits.org). CI runs
format, lint, typecheck, tests and build on every pull request.

## Limitations and roadmap

Today, data lives in one browser and reminders only fire while the app is open. Next up,
following [Plan 003](docs/plans/003-free-backend-and-push.md), all on free tiers:

- **An API on Cloudflare Workers** with a D1 (SQLite) database, so routines sync between
  your phone and laptop.
- **Sign-in** with a one-time code sent by email.
- **Push reminders** sent by a scheduler that runs every minute, so they arrive even when
  the app is closed.

After that: streaks and history, and a timer for activities with a duration.
