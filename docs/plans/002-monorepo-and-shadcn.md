# Plan 002: Monorepo and shadcn/ui

| Field   | Value                 |
| ------- | --------------------- |
| Status  | Accepted              |
| Author  | naipei                |
| Created | 2026-11-26            |
| Updates | Plan 001, section 5.2 |

## 1. Summary

Move Routine Builder from a single Vite app into a pnpm + Turborepo monorepo,
split the pure logic into a shared package, and replace the hand-written CSS
with a shared shadcn/ui component library. Routing moves to TanStack Router
with file-based routes.

The app's behaviour does not change. Data model, storage format and tests from
Plan 001 carry over as they are.

## 2. Motivation

- **Stage 2 needs shared code.** Plan 001 section 8 adds a NestJS server that
  must validate the same data with the same Zod schemas. A `domain` package
  that both the web app and the server import makes that a dependency instead
  of a copy.
- **A real component library.** The current UI is hand-written CSS. shadcn/ui
  gives accessible Radix primitives, Tailwind styling and themeable tokens,
  kept in a package so every app uses the same components.
- **Real URLs.** With view state held in React, a reload always lands on the
  list. File-based routes give each screen a URL that survives reloads and can
  be linked to.
- **Familiar structure.** The layout matches a production TypeScript monorepo
  (pnpm workspaces, Turborepo, apps and packages), so the project doubles as a
  demonstration of working in that kind of codebase.

## 3. Target layout

```
routine-builder/
├── apps/
│   └── web/                 React 19 + Vite + TanStack Router
│       └── src/
│           ├── routes/      File-based routes → routeTree.gen.ts
│           ├── components/  Feature components, grouped by area
│           ├── state/       AppStateProvider (React context)
│           └── storage/     localStorage repository, migrations
├── packages/
│   ├── domain/              @routine-builder/domain: Zod schemas, pure logic
│   └── ui/                  @routine-builder/ui: shadcn components + theme
├── docs/plans/              Numbered plans (this file is 002)
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Later, Stage 2 adds `apps/server` (NestJS), `packages/database` (Prisma) and
any shared API contract package.

### Package rules

- `domain` has no React and no browser APIs. It runs in Node, so its tests use
  Vitest's `node` environment.
- `ui` has no app logic. It exports presentational components and the theme.
  Apps import components from it instead of writing one-off versions.
- `apps/web` wires them together: routes, state, storage and browser APIs.
- Internal packages export TypeScript source directly (no build step). Vite
  and `tsc` compile them as part of the app, which keeps the setup simple and
  editor "go to definition" lands on real source.

## 4. Tooling

| Concern         | Choice                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Package manager | pnpm workspaces (`packageManager` pinned in root `package.json`)                                 |
| Task runner     | Turborepo: `build`, `lint`, `typecheck`, `test` with caching                                     |
| Formatting      | Prettier at the root, for the whole repo                                                         |
| Linting         | oxlint, one shared root config, run per package through Turborepo                                |
| Routing         | TanStack Router with the Vite plugin generating `routeTree.gen.ts`                               |
| Styling         | Tailwind CSS v4, shadcn/ui, OKLCH color tokens (the current shadcn default), light and dark mode |
| CI              | `pnpm install --frozen-lockfile`, format check, then `turbo run`                                 |

Common commands:

```
pnpm install
pnpm dev                              # all apps
pnpm --filter @routine-builder/web test
pnpm turbo run lint typecheck test build
```

## 5. Routes

| URL                         | Screen                          |
| --------------------------- | ------------------------------- |
| `/`                         | Routine list (Today view later) |
| `/routines/new`             | Create routine                  |
| `/routines/$routineId/edit` | Edit routine                    |

An unknown `routineId` shows the existing "Routine not found" state.

## 6. What is deliberately not adopted yet

| Piece                         | When                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `apps/server`, NestJS, Prisma | Stage 2 (Plan 001 section 8)                                 |
| BullMQ, Web Push              | Stage 2                                                      |
| GraphQL, Apollo Client        | Stage 2, if the API is GraphQL                               |
| TanStack Start, route loaders | Only useful with server data; state lives in the browser now |
| Valtio                        | When UI-only state outgrows component state                  |

## 7. Delivery

| PR  | Branch           | Contents                                                                  |
| --- | ---------------- | ------------------------------------------------------------------------- |
| A   | `chore/monorepo` | This plan; pnpm + Turborepo; `apps/web`; `packages/domain`; CI on pnpm    |
| B   | `feat/shadcn-ui` | `packages/ui` with shadcn; TanStack Router; list and editor rebuilt on it |

PR A changes structure only: the UI looks the same and every existing test
passes unchanged apart from import paths. PR B changes the UI and adds
routing. The remaining Plan 001 work (Today view, reminders, deploy) follows
on top of PR B.
