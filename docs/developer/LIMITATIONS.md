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

| Item           | Appears when                                                                                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google sign-in | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set **and** an Android OAuth client exists for the build's signing key. Native: Android's account picker, ID token passed to Supabase. Configured and working on the live project since 23 September 2026 |
| Phone OTP      | `EXPO_PUBLIC_ENABLE_PHONE_OTP` is exactly `"true"` **and** an SMS provider is configured in Supabase                                                                                                                                            |
| Anonymous AI   | `EXPO_PUBLIC_ALLOW_ANONYMOUS_AI` is `"true"` **and** the function carries the matching secret                                                                                                                                                   |

## Flashcard scheduling is not SM-2

A full SM-2 implementation exists in `packages/shared/src/flashcards/scheduling.ts`
and is exhaustively tested — but **the review screen does not call it.** The UI
offers three fixed delays (1d, 2d, 4d) through `scheduleWithDelay()`, chosen so
the buttons say exactly what they do. A fourth, five-minute option was removed in
September 2026: a card due again before the session ended kept reappearing, and
students read that as the screen being broken.

SM-2's bookkeeping is still maintained underneath: every rating updates the ease
factor and repetitions, and only `dueAt` comes from the student's choice. So the record needed to switch to SM-2 scheduling later is
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

**Demo mode bypasses authentication entirely.** Gated behind an explicit flag
and never on by default. The banner that labelled every demo screen was removed
at the project owner's request (September 2026), so the browser demo no longer
says on-screen that it is local and unauthenticated.

**Conversations are saved, but the model does not see earlier messages.**
Each question is sent on its own, so "and what about the second one?" means
nothing to it. Sending recent messages as context would cost more tokens per
question. Pictures in saved conversations stay on the device that sent them. One
picture per question.

**The Gemini API key is on the free tier.** About 20 requests a day for the main
model and about 500 for the Flash-Lite fallback, shared by every student, and
students' content may be used by Google to improve its products. Fine for a
demonstration; not for real users. See
[AI_COSTS_AND_PROVIDERS.md](AI_COSTS_AND_PROVIDERS.md).

**A long competitive quiz is slow to write.** Fifteen competitive questions can
take 30–60 seconds; the tracker shows "Asking the assistant…" meanwhile.

**Signing in with Google requires Google Play services** and an Android OAuth
client registered for the exact signing key of the build. A build signed with a
different key shows "Google sign-in is not set up for this version of the app".

**The APK is about 41 MB**, not the 20–30 MB once hoped for. That floor is React
Native, Hermes and the native modules the features need; a Play Store app bundle
would bring the download down, a single APK cannot.

## Not fully validated

**Sync has run against the hosted project, but a two-device conflict has not
been observed.** Since 21 September 2026 the live project has every table, and a
full reinstall has been seen to restore courses, topic ticks, flashcards and
sessions from the server. What has not been observed end to end is two devices
editing the same row while apart — that is covered only by the engine tests.

**The RLS claims are verified by the tests described in SECURITY.md**, which is
not the same as a security audit.

**The `subtopics` and `flashcards` policies were never tested in isolation.**
They were written by analogy while Docker was unavailable. All four migrations
have since been applied to the live project (through
`supabase/apply-all-migrations.sql`) and sync reads and writes both tables
there, which shows the grants and policies admit the owner — but no test
asserts that they refuse another user.

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
