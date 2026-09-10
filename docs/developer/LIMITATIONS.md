# Limitations

Everything not built, not verified, or knowingly compromised. Read this before
the other documents.

## Hardware and deployment status

**The APK has been built and tested on a real Android device**, and the Supabase
project, the deployed `ask-gemini` Edge Function and the Gemini key are all live.
This is recorded on the project owner's confirmation (12 September 2026) — it is
a claim about the world, which the repository cannot evidence either way.

Previously mocked-and-unproven paths that device testing exercises:

- Notification delivery, scheduling accuracy, permission prompts
- `useKeepAwake` during a focus session
- Haptics
- Keystore reads and writes, including the chunked session adapter
- `AppState` transitions — which the timer's entire design targets
- The SQLite pragmas (`foreign_keys`, WAL) actually applying

**Device testing is not the same as systematic device testing.** These paths have
been exercised, not measured across Android versions, OEM battery-optimisation
policies or locales. Notification scheduling in particular is where aggressive
OEM power management diverges most from stock Android.

## Not built

| Item                            | Blocked on      | Notes                                                                          |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| Drag-to-reorder                 | —               | Repositories support reorder; the UI offers up/down from a menu                |
| Durable AI rate limiting        | —               | The limit is in-memory per instance; it bounds runaway use, it is not a quota  |
| Local database encryption       | —               | SQLite is stored unencrypted on the device                                     |
| Phone OTP against real delivery | An SMS provider | Implemented end to end behind a flag; never tested against a real SMS provider |

## Implemented but configuration-gated

| Item           | Appears when                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google sign-in | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set. The flow itself is complete: Supabase PKCE through the system browser, unit-tested in `features/auth/__tests__/google.test.ts` |
| Phone OTP      | `EXPO_PUBLIC_ENABLE_PHONE_OTP` is exactly `"true"` **and** an SMS provider is configured in Supabase                                                                      |
| Anonymous AI   | `EXPO_PUBLIC_ALLOW_ANONYMOUS_AI` is `"true"` **and** the function carries the matching secret                                                                             |

## Flashcard scheduling is not SM-2

A full SM-2 implementation exists in `packages/shared/src/flashcards/scheduling.ts`
and is exhaustively tested — but **the review screen does not call it.** The UI
offers four fixed delays (5m, 1d, 2d, 4d) through `scheduleWithDelay()`, chosen so
the buttons say exactly what they do.

SM-2's bookkeeping is still maintained underneath: choosing `5m` counts as a
lapse, drops the ease factor and resets repetitions. Only `dueAt` comes from the
student's choice. So the record needed to switch to SM-2 scheduling later is
being kept — but **PrepPilot today does fixed-interval spaced repetition, not
SM-2 spaced repetition**, and should not be described as the latter.

See `docs/AUDIT.md` (F-1, OQ-1).

## Knowingly compromised

**Focus Mode cannot block apps.** Android does not permit it without an
AccessibilityService or device-admin privileges, both restricted by Play Store
policy. It counts departures instead, and says so in an in-app capability list.

**Do Not Disturb is not toggled.** It needs a permission no Expo module exposes.

**Weekday reminders are re-armed by the app**, since neither platform has a
weekday-only trigger. If the app is never opened, they stop firing.

**The local database is not encrypted.**

**Demo mode bypasses authentication entirely.** Gated behind an explicit flag,
labelled on every screen, never on by default.

## Not fully validated

**Sync has not run against the hosted project.** The engine is tested against a
real local database and an in-memory server, and the payload shape was verified
against real Postgres under RLS — but a genuine two-device conflict has not been
observed end to end.

**The RLS claims are verified by the tests described in SECURITY.md**, which is
not the same as a security audit.

**The `subtopics` and `flashcards` migration has not been run against Postgres.**
The earlier tables were checked against a real database — which is how the
missing `GRANT` was found — but Docker was unavailable when these were written,
so their policies are written by analogy rather than verified. Run
`supabase db push` against a branch before trusting them.

**Sub-topics change what a percentage counts.** A topic broken into parts
contributes those parts, so the same syllabus reports a different figure after
one is added. That is deliberate — a four-part topic is four times the work —
but a student watching the number will see it move when they add a sub-topic
without completing anything.

## Where the code departs from the specification

Each is recorded with reasoning in [`../../DECISIONS.md`](../../DECISIONS.md):

- **D1** — sign-in is required, so "offline-first" means _after the first sign-in_
- **D33** — "field-level" conflict resolution is implemented for the two fields
  that can actually conflict independently, not per column
- **D48** — Focus Mode delivers a subset of what D22 described
- **D51** — _superseded._ The library now holds **22 bundled templates**: JEE
  Main, JEE Advanced and NEET UG (generated from source syllabi), ten CBSE
  streams (classes 9 and 10; classes 11 and 12 in PCM, PCMB, Commerce and
  Humanities), and nine competitive/professional syllabi (UPSC CSE, SSC CGL,
  GATE CS/IT, NEET PG, CA Foundation/Intermediate/Final, MBBS, DevOps). Two
  labelled examples remain alongside them. This satisfies PRD §13
- **D53** — account deletion now removes the server account through the
  `delete-account` Edge Function; until that function is deployed the app clears
  the device and says plainly that the account itself remains
