# PrepPilot — Features

## Core

- Offline-first syllabus tracker
- Subject → Chapter → Topic → Sub-topic (the fourth level is optional and
  student-created; nothing generates sub-topics automatically)
- Topic and sub-topic checkboxes
- Notes against any topic
- Chapter progress bars
- Subject circular progress
- Overall progress
- CRUD

## Study

- Stopwatch
- Pomodoro
- Custom timer
- Study history
- Total study time

## Templates

- 10+ prebuilt templates
- Custom template
- Preview
- Import
- Editing after import

## Revision

- Spaced-repetition flashcards (SM-2, with learning steps)
- Review queue by due date

## AI

- Gemini explanations
- Questions
- Insights
- User-requested study plans

## Productivity

- Student-created reminders
- Focus Mode

## Account

- Email/password
- Google
- Phone OTP
- Account deletion

## Data

- Offline local database
- Supabase synchronization
- User-level isolation

## Web

- Browser-based display/demo

---

## As built (September 2026)

The list above is the specification. What the application actually delivers,
with departures recorded in `DECISIONS.md` and `docs/developer/LIMITATIONS.md`:

| Area         | Delivered                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tracker      | Four-level hierarchy, topic-weighted progress, notes on topics, multiple courses                                                   |
| Courses      | 22 bundled templates (+2 examples), import with subject picker, **Build from scratch** form                                        |
| Study        | Stopwatch, Pomodoro, custom timer; sessions, history, dashboard, streaks                                                           |
| Revision     | Flashcards with three fixed review intervals (1d, 2d, 4d); SM-2 kept underneath but not driving the schedule                       |
| AI           | Ask, summarise a topic, quiz a topic; **attach a photo or screenshot**; formatted replies; propose-then-confirm syllabus additions |
| Productivity | Reminders (weekday and one-off), Focus Mode within Android's limits                                                                |
| Account      | Email/password with in-app confirmation link, **native Google sign-in**, phone OTP behind a flag, guest, account deletion          |
| Data         | SQLite on the device, Supabase sync on sign-in / every 5 min / on leaving / on reconnect, RLS isolation                            |
| Web          | The same app in a browser (demo mode), hosted at preppilottdemo.netlify.app                                                        |
