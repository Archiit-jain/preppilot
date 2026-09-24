# PrepPilot — Repository Audit

**Date:** 12 September 2026
**Scope:** Full source audit of the PrepPilot monorepo, reconciling the
implementation against the documentation set.
**Method:** Source files, database schema, SQL migrations, Edge Functions, test
suites, CI configuration and package manifests were read directly. Documentation
was treated as a claim to be checked, never as evidence.

> **Rule applied throughout:** where documentation and code disagreed, the code
> won. Where neither could settle a question, it is listed under
> [Open questions](#open-questions) rather than resolved by assumption.

> **Addendum — 24 September 2026.** This audit is a dated snapshot and is kept
> as written. Since it was made:
>
> - The suite is now **1,934 tests across 91 suites** (mobile 74 / 1,386,
>   shared 15 / 508, Deno 2 / 40), all passing.
> - **F-1 / OQ-1 answered:** the fixed intervals are deliberate, and the `5m`
>   option has been removed. The review screen offers **1d, 2d, 4d** (D80).
> - **F-4 superseded:** Google sign-in no longer uses the browser flow described
>   there. It is native — Android's account picker and `signInWithIdToken` (D87).
> - **OQ-3 partly answered:** all four migrations, subtopics and flashcards
>   included, are applied to the live project and sync uses them; cross-user
>   refusal for those two tables is still untested.
> - The assistant accepts pictures and renders formatted replies (D89, D90).
>
> See `DECISIONS.md` §10 (D79–D92) for every change and its reason.

---

## 1. What was inspected

| Area                 | Evidence read                                                                           |
| -------------------- | --------------------------------------------------------------------------------------- |
| Repository structure | `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`                             |
| Mobile application   | `apps/mobile/src/**` — 19 route files, 16 feature modules                               |
| Routing              | `apps/mobile/src/app/(app)/*`, `(auth)/*`, `_layout.tsx`                                |
| State management     | `*-store.ts` across features (Zustand)                                                  |
| Local database       | `apps/mobile/src/db/schema.ts`, `client.ts`, `client.web.ts`, `repositories/*`          |
| Cloud database       | `supabase/migrations/*.sql` (4 migrations)                                              |
| Edge Functions       | `supabase/functions/ask-gemini/`, `supabase/functions/delete-account/`                  |
| AI                   | `packages/shared/src/ai/*`, `apps/mobile/src/features/ai/*`                             |
| Sync                 | `apps/mobile/src/features/sync/sync-engine.ts`, `packages/shared/src/sync/merge.ts`     |
| Progress engine      | `packages/shared/src/progress/progress.ts`                                              |
| Timers               | `packages/shared/src/timer/timer.ts`, `features/timer/*`                                |
| Flashcards           | `packages/shared/src/flashcards/scheduling.ts`, `features/flashcards/*`                 |
| Reminders            | `packages/shared/src/reminders/schedule.ts`, `notifications.ts`, `notifications.web.ts` |
| Focus Mode           | `apps/mobile/src/features/focus/*`                                                      |
| Templates            | `packages/shared/src/templates/**`                                                      |
| Statistics           | `packages/shared/src/stats/sessions.ts`                                                 |
| Security             | RLS policies in migrations, `apps/mobile/src/config/env.ts`                             |
| Tests                | 80 suites / 1,799 tests, run from a clean install; 2 Deno function suites               |
| CI                   | `.github/workflows/ci.yml`                                                              |
| Build config         | `eas.json`, `app.json`, `apps/mobile/package.json`                                      |

---

## 2. Confirmed implementation

Each item below was verified by reading the implementing code, not a filename or
a document.

### Architecture

The project is a **pnpm workspace monorepo** with three parts: `apps/mobile`
(Expo + React Native), `packages/shared` (framework-agnostic domain logic), and
`supabase/` (migrations and Edge Functions). `packages/shared` holds the
progress engine, timer engine, SM-2 scheduling, reminder recurrence, conflict
resolution, AI parsing and design tokens — deliberately free of React Native
imports so the same logic runs in the app, the browser build and the test suite.

**There is no Node.js backend server in this repository.** Node is the toolchain
(build, test, bundling). The backend is Supabase: Postgres, Auth, and two Deno
Edge Functions.

### Local data layer

`apps/mobile/src/db/schema.ts` defines **nine tables** through Drizzle ORM:
`trackers`, `subjects`, `chapters`, `topics`, `subtopics`, `flashcards`,
`study_sessions`, `reminders`, `preferences`.

Conventions verified across every synchronised table:

- **Client-generated UUIDv7 primary keys**, so a record created offline has its
  final identifier immediately and arrives at the server as a conflict rather
  than a duplicate.
- **`userId` denormalised onto every table**, so one predicate scopes a query and
  the RLS policies mirror it exactly.
- **Timestamps as epoch milliseconds** in INTEGER columns.
- **Tombstones (`deletedAt`)** rather than hard deletes — a row deleted offline
  and then removed outright would be resurrected by the next pull.
- **`syncStatus`** (`pending` | `synced`) tracking unsent local changes.
- **`completedChangedAt`** on `topics` and `subtopics`, tracking completion
  separately from the rest of the row.

Two database drivers exist: `expo-sqlite` on device and **sql.js compiled to
WebAssembly** in the browser (`client.web.ts`), which is what makes the web demo
run a genuine SQLite database rather than a mock.

### Syllabus hierarchy and progress

The hierarchy is **Subject → Chapter → Topic → optional Sub-topic**, confirmed by
the foreign keys in `schema.ts`.

`packages/shared/src/progress/progress.ts` implements:

- **Topic-weighted subject progress.** All completed units under a subject
  divided by all units — explicitly _not_ the mean of chapter percentages. A
  subject with a 1-of-1 chapter and a 0-of-99 chapter reports 1%, not 50%. A
  regression test guards this.
- **Sub-topics become the counted unit** where they exist (`topicUnits`), so a
  topic split into four parts weighs four times one that is not.
- **Empty is not zero.** A chapter with no topics returns `percent: null`, not
  `0`, and renders as an em dash.
- **One traversal** computes chapter, subject and overall progress together, so
  the five figures on screen cannot disagree.

### Timers and study sessions

`packages/shared/src/timer/timer.ts`. Three modes: **stopwatch, Pomodoro,
custom**. Elapsed time is **derived from timestamps**, never accumulated by a
ticking counter, so a backgrounded or killed process does not under-report.

**Pomodoro breaks are excluded from recorded study time** — `isStudyPhase()`
returns true only for `stopwatch`, `custom`, or the Pomodoro `work` phase.
Confirmed: the `durationSeconds` column comment states the same.

Pomodoro is configurable within bounds (work 5–120 min, short break 1–60,
long break 5–120, 2–8 cycles) and defaults to 25/5/15/4 with manual phase
advance. Sessions interrupted by process death are recorded as `abandoned`
with the last heartbeat's duration.

### Flashcards — see [Finding F-1](#f-1-flashcards-do-not-use-sm-2-in-the-shipping-ui)

Cards hang off a topic by a **soft reference** (no foreign key, topic name
snapshotted), so deleting a topic does not destroy its cards or review history.

### Synchronisation

`sync-engine.ts` runs **pull → merge → push**, one table at a time, parents
before children. Pushing first would overwrite the server with an unreconciled
local row; merging first means what is pushed is already the agreed version.

**Eight tables synchronise**: trackers, subjects, chapters, topics, subtopics,
flashcards, study_sessions, reminders. **`preferences` is not synchronised** —
it is device-local.

Conflict resolution (`packages/shared/src/sync/merge.ts`), verified rule by rule:

1. **A tombstone wins.** Deletion is sticky; the earliest tombstone is taken.
2. **Completion resolves on its own timestamp**, independently of the rest of the
   row, so a rename on one device cannot revert a tick made on another.
3. **A tie on completion resolves to completed** — silently un-ticking finished
   work is the worse error.
4. **Everything else is last-write-wins on `updatedAt`**, with the local copy
   winning an exact tie.

The pull watermark is taken from the **server's** `updated_at`, not the device
clock, so a device with a fast clock cannot bookmark a future instant and
permanently skip rows.

### Authentication

Supabase Auth. Verified paths: **email/password**, **Google OAuth**, **phone
OTP** (behind `EXPO_PUBLIC_ENABLE_PHONE_OTP`), and a **guest/demo mode**.

### AI

The flow is **Client → Supabase Edge Function → Gemini API**. The Gemini key is
read from a Supabase secret inside `ask-gemini/index.ts` and never returned to
the client; no key appears anywhere under `apps/`.

Verified in the Edge Function:

- Model **`gemini-3.6-flash`**, pinned deliberately rather than tracking an alias.
- **Thinking budget capped at 512 tokens.**
- **Rate limits:** 20 requests/hour per account; 60/hour shared across anonymous
  callers when `ALLOW_ANONYMOUS_AI` is exactly `"true"`. The limit is in-memory
  and per-instance — it bounds runaway use, it is not a durable quota.
- **Caller identity is read from the JWT `sub` claim**, not a header, so the
  limit cannot be bypassed by editing a request.
- **Three modes:** `ask`, `summarize`, `quiz`.
- Upstream error bodies are never forwarded (they can carry key or quota detail).

**What the AI may change is structurally bounded.** A reply can only ever
_propose_, and the proposal grammar (`packages/shared/src/ai/proposal.ts`) has
exactly two verbs: `addChapters` and `addTopics`. **There is no verb for
deleting, completing or reordering anything.** Proposals are parsed into an inert
object; applying is a separate, explicitly confirmed step
(**AI Proposal → User Review → Confirmation → Apply**). Names returned by the
model are validated exactly as typed input is. A proposal over
`MAX_REVIEWABLE_TOPICS` (200) is flagged as too large to review at once.

### Templates

**22 bundled templates**, plus 2 clearly-labelled examples:

| Group                         | Count | Entries                                                                                |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------- |
| Generated from source syllabi | 3     | JEE Main 2026, JEE Advanced 2026, NEET UG 2026                                         |
| CBSE (hand-written)           | 10    | Classes 9, 10; Class 11 & 12 in PCM, PCMB, Commerce, Humanities                        |
| Competitive & professional    | 9     | UPSC CSE, SSC CGL, GATE CS/IT, NEET PG, CA Foundation/Intermediate/Final, MBBS, DevOps |
| Examples                      | 2     | Labelled `verified: false`, shown as examples                                          |

Templates are **bundled, not fetched**, so importing one works offline. Each
carries a `source` string and a `verified` flag, both shown in the library.
Importing **copies** the syllabus — `templateId` is a label, not a live link, so
the student's copy is free to diverge.

### Focus Mode

Verified behaviour: a single distraction-free screen, `useKeepAwake` while a
session runs, and a **count of the times the student left the app**, plus a
capability panel stating what is and is not possible.

**It does not block other applications and does not toggle Do Not Disturb.**
Android does not permit app-blocking without an AccessibilityService or
device-admin privileges, both restricted by Play Store policy. The screen says
so in the UI rather than implying otherwise.

### Reminders

Repeat rules: `none`, `daily`, `weekdays`, `weekly` — a small enum rather than
RRULE. Recurrence stepping is day-by-day so wall-clock time survives
daylight-saving shifts.

Two implementations, selected by Metro at build time:

- **Native** (`notifications.ts`) — `expo-notifications`, the OS holds the
  schedule.
- **Web** (`notifications.web.ts`) — a `setTimeout` held in the tab firing the
  browser's own `Notification`. **This stops when the tab closes**, and the
  reminders screen says so. It also refuses delays beyond ~24.8 days, where
  `setTimeout` saturates and would otherwise fire immediately.

**Weekday reminders are re-armed by the app**, since neither platform offers a
weekday-only trigger. If the app is never opened, they stop firing.

### Security

- **RLS is `enable`d _and_ `force`d** on every table, so policies apply to the
  table owner too.
- Policies for **select, insert and update**, each scoped to `auth.uid()`.
- **No delete policy anywhere** — deletion happens by tombstone, and the absence
  of the policy is what enforces it at the database.
- Only `EXPO_PUBLIC_*` values reach the client bundle. The Supabase anon key is
  publishable and bounded by RLS; **the service-role key and the Gemini key exist
  only server-side**.
- `delete-account` verifies the token **against Supabase** rather than merely
  decoding it, and reads no id from the request body — so it can only ever delete
  the caller's own account.

### Testing and CI

`.github/workflows/ci.yml` runs, on every push to `main` and every pull request:
format check → typecheck → tests with coverage thresholds → **Deno tests for the
Edge Functions** → **an Android bundle build** → **a web bundle build**.

The last two exist because a green unit suite does not prove the app still
bundles through a pnpm workspace.

**Measured during this audit** by running the suite from a clean install:

| Package           | Suites | Tests     | Result          |
| ----------------- | ------ | --------- | --------------- |
| `packages/shared` | 15     | 512       | all passing     |
| `apps/mobile`     | 65     | 1,287     | all passing     |
| **Total**         | **80** | **1,799** | **all passing** |

The mobile suites cover stores, screens, repositories, the sync engine and the
database layer. Coverage thresholds are enforced in CI (`pnpm test:coverage`).

---

## 3. Findings — where documentation and code disagreed

### F-1: Flashcards do not use SM-2 in the shipping UI

**Severity: high — this is the largest single gap between docs and behaviour.**

`packages/shared/src/flashcards/scheduling.ts` contains a complete, tested SM-2
implementation: `reviewCard()`, ease-factor adjustment, lapse handling, learning
steps, `previewIntervals()`.

**The user interface does not call it.** `flashcards-store.ts:165` calls
`scheduleWithDelay()`, and `flashcards-screen.tsx` renders `REVIEW_DELAYS` — four
**fixed** options: **5m, 1d, 2d, 4d**. `reviewCard` is referenced only by
`previewIntervals` and by its own tests.

The code documents the reasoning: fixed delays "say exactly what they do, which
is what makes the choice a judgement about the card rather than a guess about the
algorithm." SM-2 bookkeeping (repetitions, lapses, ease) is still maintained
underneath — choosing `5m` counts as a lapse and drops ease by 0.2 — so a future
switch back to SM-2 has history to work from. But **only `dueAt` drives the
schedule, and it comes from the student's choice, not from SM-2.**

Meanwhile `schema.ts:207` describes flashcards as "reviewed on an SM-2 schedule."

**Resolution applied:** documentation and presentation now describe the shipping
behaviour — _fixed-interval spaced repetition with SM-2 statistics maintained
underneath_ — and do not claim SM-2 scheduling. Flagged as
[Open question OQ-1](#oq-1-is-the-fixed-delay-scheduler-intentional).

### F-2: README status table was substantially wrong

`README.md` claimed:

> Phase 5 — Timers and study sessions ⏳ Next
> Phases 6–14 — Dashboard, templates, sync, notifications, AI, Focus Mode, web ⬜ Not started

Every one of those is implemented, with routes, stores, repositories and tests.
**Corrected.**

### F-3: README described a web app that does not exist

`README.md` listed `apps/web/` as "Vite + React demonstration UI". **There is no
`apps/web` directory.** The web build is the _same_ Expo application exported
for web (`expo export --platform web`) with `react-native-web`, using sql.js/WASM
for its database. **Corrected.**

### F-4: LIMITATIONS.md claimed Google sign-in was not implemented

> Google sign-in | An OAuth client | Configuration is wired; the native flow is not implemented

`apps/mobile/src/features/auth/google.ts` implements the full flow: Supabase
PKCE, `signInWithOAuth` with `skipBrowserRedirect`, the system browser via
`WebBrowser.openAuthSessionAsync`, redirect handling, and code-for-session
exchange. It is dependency-injected and unit-tested (`__tests__/google.test.ts`).
It requires a configured `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to appear in the UI.
**Corrected: implemented, gated on configuration.**

### F-5: LIMITATIONS.md claimed the template library held two unverified examples

> Real syllabus templates | Verified content | the library holds two examples, both marked unverified

The library now holds **22 templates** plus the 2 examples. **Corrected.**

Related: `DECISIONS.md` D51 says "the CBSE streams are not yet [real]" — ten CBSE
templates now exist, hand-written from published syllabi. **Noted in-place rather
than rewritten**, since DECISIONS.md is a dated historical record.

### F-6: LIMITATIONS.md claimed nothing had run on Android hardware

> **Nothing in this project has run on an Android device.**

**The project owner confirms the APK has been built and tested on a real Android
phone.** This is not something the repository can evidence either way — it is a
claim about the world, not about code. Updated on the owner's confirmation, and
the confirmation is recorded here as its source.

### F-7: LIMITATIONS.md claimed the AI assistant was non-functional

> The AI assistant working | A Gemini key | Client and proxy are built; the function is not deployed

**The project owner confirms Supabase is live, the Edge Function is deployed and
the Gemini key is configured.** Again not repository-evidenced: `ai-client.ts`
still carries the comment "The function is not deployed yet." **Updated on the
owner's confirmation**, comment noted as stale.

### F-8: TECH_STACK.md was a specification, not a stack

The file read as a shopping list — _"Select a reliable mobile database based
on: Expo compatibility, Android reliability…"_ and _"Zustand or equivalent"_.
Those decisions were made long ago. **Rewritten as-built**, with exact versions
from the manifests and an explicit note that Node.js is tooling, not the backend.

### F-9: A stale docstring about template verification

`bundled.ts` states generated templates "are marked `verified: false` until
someone checks them against the awarding body's own published syllabus." In
`bundled.generated.ts` the three generated templates carry **`verified: true`**.
Thirteen `verified: true` flags were counted across the curated set; only the two
examples carry `verified: false`.

**Not silently changed** — this is a content-provenance question, not a code
question. See [OQ-2](#oq-2-are-the-generated-templates-genuinely-verified).

---

## 4. Limitations confirmed in code

These were checked and found **accurate**. They are preserved, and stated on the
relevant presentation slides rather than hidden.

| Limitation                                      | Evidence                                                  |
| ----------------------------------------------- | --------------------------------------------------------- |
| Focus Mode cannot block other apps              | `focus/capabilities.ts`, stated in-app                    |
| Focus Mode does not toggle Do Not Disturb       | No permission exists in any Expo module                   |
| Web reminders die when the tab closes           | `notifications.web.ts`, `remindersSurviveClosing = false` |
| Weekday reminders need the app opened to re-arm | `schedule.ts`; no platform weekday trigger                |
| The local SQLite database is not encrypted      | No cipher configured                                      |
| AI requires a network connection                | `describeFailure()` treats offline as expected            |
| The AI rate limit is per-instance, not durable  | In-memory `Map`, resets on recycle                        |
| Sub-topics change what a percentage counts      | `topicUnits()` — deliberate, but visible                  |
| Reordering is menu-based, not drag-and-drop     | `reorderIds` + up/down menu actions                       |
| Sign-in is required before offline use          | D1 — "offline-first" means after first sign-in            |

---

## 5. Open questions

### OQ-1: Is the fixed-delay scheduler intentional?

SM-2 is implemented and tested but unreachable from the UI. Either the fixed
delays are the deliberate product decision (the code comments suggest so) and
SM-2 is retained for a future switch, or the wiring was never completed.

**Documentation currently describes the fixed-delay behaviour**, because that is
what the code does. If SM-2 is meant to be live, this is a one-line change in
`flashcards-store.ts` — and the docs would then need reverting.

### OQ-2: Are the generated templates genuinely verified?

Three generated templates carry `verified: true` while `bundled.ts` says
generated content stays `verified: false` until checked against the awarding
body. Whoever set the flag knows whether that check happened; the repository
cannot say. The flag is presented to students as a trust signal, so it matters.

### OQ-3: Coverage of the subtopics/flashcards migration against Postgres

`LIMITATIONS.md` states this migration's policies were "written by analogy rather
than verified" because Docker was unavailable. Given Supabase is now live, this
may have since been exercised. **Left as stated** — unverified either way.

---

## 6. Documentation changes made

| File                            | Change                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                     | Corrected the phase/status table; removed the non-existent `apps/web` Vite description; corrected the web-demo explanation |
| `docs/TECH_STACK.md`            | Rewritten as-built with exact versions; Node.js explicitly classified as tooling                                           |
| `docs/FEATURES.md`              | Feature list aligned to implementation with explicit status markers                                                        |
| `docs/developer/LIMITATIONS.md` | Corrected F-4 through F-7; preserved every limitation still true                                                           |
| `docs/AUDIT.md`                 | **New** — this document                                                                                                    |
| `docs/SYNOPSIS.md`              | **New** — formal project synopsis                                                                                          |

Documents **deliberately left alone**: `DECISIONS.md` (a dated historical record
— superseded entries are noted here, not rewritten), `docs/PRD.md` and the other
specification documents that describe intent rather than implementation, and
`docs/UI_UX_SPECIFICATION.md`.

---

## 7. Status vocabulary

Used consistently across the updated documentation:

| Term                                 | Meaning                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| **Implemented**                      | Code exists, runs, and is covered by tests                   |
| **Implemented, configuration-gated** | Complete, but hidden until a secret or client id is supplied |
| **Implemented, platform-limited**    | Works, with a stated platform restriction                    |
| **Deployed**                         | Running against the live Supabase project (owner-confirmed)  |
| **Not implemented**                  | No code path exists                                          |
| **Requires verification**            | Cannot be settled from the repository alone                  |
