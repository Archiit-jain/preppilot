# PrepPilot

**Offline-first study tracking for students.** Organise a syllabus as
`Subject → Chapter → Topic`, check off what you have actually finished, time your
study sessions, and see honest progress — with or without an internet connection.

> **Tracker first, AI second.** Gemini assistance supports the workflow; it never
> drives it, and it never changes your syllabus without your confirmation.

## Status

All planned feature areas are implemented and covered by tests. See
[`DECISIONS.md`](DECISIONS.md) for the decisions this implementation is built on,
[`docs/AUDIT.md`](docs/AUDIT.md) for an evidence-based audit of what the code
actually does, and [`docs/developer/LIMITATIONS.md`](docs/developer/LIMITATIONS.md)
for what remains unbuilt or unverified.

| Area                                         | Status                      |
| -------------------------------------------- | --------------------------- |
| Foundation (monorepo, tooling, CI)           | ✅ Implemented              |
| Progress engine + design tokens              | ✅ Implemented              |
| Expo app + design system components          | ✅ Implemented              |
| Authentication (email, native Google, guest) | ✅ Implemented              |
| Phone OTP                                    | ⚙️ Behind a flag            |
| Offline tracker: SQLite + Drizzle data layer | ✅ Implemented              |
| Offline tracker: UI                          | ✅ Implemented              |
| Timers and study sessions                    | ✅ Implemented              |
| Dashboard, history and statistics            | ✅ Implemented              |
| Syllabus templates (22 bundled)              | ✅ Implemented              |
| Build a course from scratch                  | ✅ Implemented              |
| Multiple courses                             | ✅ Implemented              |
| Notes, flashcards, reminders                 | ✅ Implemented              |
| Synchronisation and conflict resolution      | ✅ Implemented, auto-sync   |
| AI assistant (Gemini via Edge Function)      | ✅ Implemented              |
| AI: questions about a photo or screenshot    | ✅ Implemented              |
| Focus Mode                                   | ✅ Implemented, see caveats |
| Web demo build                               | ✅ Implemented              |

Test suite: **1,934 tests across 91 suites**, all passing — 1,386 in the app,
508 in the shared package, 40 for the Edge Functions.

The Android APK (EAS `preview-live` profile, arm64) is about 41 MB and has been
run on a physical phone against the live Supabase project: sign-in by email and
Google, sync across a reinstall, and the assistant including picture questions.

## What changed in September 2026

Device testing drove a round of fixes, each recorded in
[`DECISIONS.md`](DECISIONS.md) (D79–D92):

- **Faster and closer to the web build on Android** — the tracker reads a course
  in four queries instead of hundreds, and NativeWind, which was distorting
  several components on Android, is gone.
- **Sync you do not have to think about** — on sign-in, every five minutes, on
  leaving the app and on reconnecting; large syllabi are pulled in pages; local
  data shows first on launch.
- **Sign-in that returns to the app** — native Google sign-in, and email
  confirmation links that open PrepPilot rather than `localhost`.
- **A better assistant** — attach a photo or screenshot, replies formatted
  instead of raw Markdown and LaTeX, and a text box the keyboard no longer covers.
- **Build from scratch** creates a new course from one form; flashcards offer
  three review intervals (1d, 2d, 4d).

## Repository layout

```
apps/
  mobile/          Expo + React Native app (Android primary, also exports to web)
packages/
  shared/          Progress engine, timer, scheduling, sync merge, AI parsing, tokens
supabase/          Migrations, RLS policies, Edge Functions (ask-gemini, delete-account)
docs/              Product and technical documentation
```

There is no separate web application. The browser build is the _same_ Expo app
exported for web with `react-native-web`, backed by SQLite compiled to
WebAssembly (`sql.js`) instead of `expo-sqlite`.

`packages/shared` is deliberately framework-agnostic: the mobile app and the web
demo compute progress with the _same_ code and render it with the _same_ tokens,
so the two can never disagree about a percentage or a colour.

## Getting started

Requires Node 22 (see [`.nvmrc`](.nvmrc)) and pnpm 10+.

```bash
pnpm install
```

**To try the app in a browser**, with no backend required:

```bash
pnpm --filter @preppilot/mobile web:demo
```

Then open <http://localhost:8081>. This runs in **demo mode** (`DECISIONS.md`,
D40): a fixed local account, no Supabase and a small seeded syllabus. The
tracker, timers and history are all real — they run against SQLite compiled to
WebAssembly — but nothing syncs. A hosted copy of the demo runs at
<https://preppilottdemo.netlify.app>.

For the Android app:

```bash
pnpm --filter @preppilot/mobile start
```

To build an installable APK against the live project, see
[`docs/developer/ANDROID_APK.md`](docs/developer/ANDROID_APK.md).

| Command              | What it does                                |
| -------------------- | ------------------------------------------- |
| `pnpm test`          | Run all tests                               |
| `pnpm test:coverage` | Run tests with coverage thresholds enforced |
| `pnpm typecheck`     | Type-check every package                    |
| `pnpm format`        | Format with Prettier                        |
| `pnpm format:check`  | Verify formatting (runs in CI)              |

## The progress engine

Progress is the product's core promise, so it lives in one place, is pure, and is
tested exhaustively.

```ts
import { calculateSyllabusProgress, formatPercent } from '@preppilot/shared';

const { overall, bySubject, byChapter } = calculateSyllabusProgress(subjects);

formatPercent(overall); // "50%"
formatPercent(overall, { precision: 2 }); // "50.00%"
```

Two rules it exists to enforce:

**Subject progress is topic-weighted.** A subject with a 1-of-1 chapter and a
0-of-99 chapter is **1%** complete, not 50%. Averaging chapter percentages — the
obvious and wrong implementation — is guarded by an explicit regression test.

**Nothing to measure is not zero.** A chapter with no topics reports
`percent: null` and renders as `—`. Rounding is likewise honest: 9,999 of 10,000
topics displays as `99%`, never a falsely triumphant `100%`.

## Security

The Gemini API key and the Supabase service-role key are **server-side only**,
never bundled into the app or the web build. Pictures sent to the assistant go
through the same server-side function, which checks their type and size before
any quota is spent. All user data is isolated with
Supabase Row Level Security. See [`docs/SECURITY.md`](docs/SECURITY.md).

## Documentation

Two sets, kept separate because they answer different questions.

[`docs/`](docs/) is the **specification** — what PrepPilot was meant to be, and
the baseline it is assessed against. Start at
[`docs/00_DOCUMENTATION_INDEX.md`](docs/00_DOCUMENTATION_INDEX.md).

[`docs/developer/`](docs/developer/) documents the system **as built**: how it
works, why it was built that way, and where it falls short. Start at
[`docs/developer/00_INDEX.md`](docs/developer/00_INDEX.md), or go straight to
[`docs/developer/LIMITATIONS.md`](docs/developer/LIMITATIONS.md) for the honest
list of what is unbuilt and unverified.
The project synopsis and presentation are generated from
[`docs/presentation/`](docs/presentation/), and a **confidential** draft
proposal for patent filing lives in [`docs/patent/`](docs/patent/) — read its
README before sharing anything from it.

The [PRD](docs/PRD.md) is the authoritative product specification; where this
implementation departs from or extends it, [`DECISIONS.md`](DECISIONS.md) says so
and explains why.
