# PrepPilot — Technology Stack

The stack **as built**, taken from the package manifests and the source. Versions
are those pinned in `apps/mobile/package.json`, `packages/shared/package.json` and
the root `package.json`.

> **A note on terminology.** Node.js is this project's _toolchain_ — it runs the
> bundler, the test runners and the formatter. **It is not the backend.** There
> is no Node server in this repository. The backend is Supabase.

## Programming language

|                |                                                                     |
| -------------- | ------------------------------------------------------------------- |
| **TypeScript** | 5.7 (root/tooling), 6.0 (mobile app) — strict, across every package |
| **SQL**        | PostgreSQL dialect for migrations and RLS policies                  |

## Frontend / mobile application

| Technology                  | Version | Role                                                 |
| --------------------------- | ------- | ---------------------------------------------------- |
| **React Native**            | 0.86.2  | Application framework; Android is the primary target |
| **Expo**                    | SDK 57  | Native runtime, build pipeline and device APIs       |
| **React**                   | 19.2.3  | UI library                                           |
| **Expo Router**             | 57      | File-based routing and navigation                    |
| **NativeWind**              | 4.2     | Tailwind-style styling for React Native              |
| **React Native Reanimated** | 4.5     | Animation                                            |
| **React Native SVG**        | 15.15   | Vector rendering, including the logo                 |

Expo modules in use: `expo-sqlite`, `expo-secure-store`, `expo-notifications`,
`expo-crypto`, `expo-keep-awake`, `expo-network`, `expo-haptics`,
`expo-web-browser`, `expo-linking`, `expo-font`, `expo-splash-screen`.

## Web

| Technology           | Version | Role                                                         |
| -------------------- | ------- | ------------------------------------------------------------ |
| **React Native Web** | 0.21    | Renders the same app in a browser                            |
| **sql.js**           | 1.14    | SQLite compiled to WebAssembly — the browser database driver |

The web build is produced by `expo export --platform web`. It is the same
application and the same code, not a separate implementation.

## State management

|             |                                                                  |
| ----------- | ---------------------------------------------------------------- |
| **Zustand** | 5.0 — one store per feature (tracker, timer, sync, AI, focus, …) |

## Local database (offline-first)

| Technology      | Version              | Role                                                          |
| --------------- | -------------------- | ------------------------------------------------------------- |
| **SQLite**      | via `expo-sqlite` 57 | On-device store; the source of truth for all reads and writes |
| **sql.js**      | 1.14                 | The same schema in the browser, via WebAssembly               |
| **Drizzle ORM** | 0.45.2               | Typed schema, queries and migrations                          |
| **Drizzle Kit** | 0.31.10              | Migration generation                                          |

Nine tables: `trackers`, `subjects`, `chapters`, `topics`, `subtopics`,
`flashcards`, `study_sessions`, `reminders`, `preferences`.

## Backend / cloud

| Technology                  | Role                                                   |
| --------------------------- | ------------------------------------------------------ |
| **Supabase**                | The backend platform — this is the project's backend   |
| **PostgreSQL**              | Cloud database, with Row Level Security on every table |
| **Supabase Auth**           | Email/password, Google OAuth (PKCE), phone OTP         |
| **Supabase Edge Functions** | Deno runtime — `ask-gemini`, `delete-account`          |
| **Supabase CLI**            | 2.116 — migrations and deployment                      |

Four migrations under `supabase/migrations/`. Eight of the nine local tables
synchronise; `preferences` is device-local.

## AI

|                   |                                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| **Google Gemini** | Model `gemini-3.6-flash`, pinned deliberately rather than tracking an alias |
| **Access path**   | `Client → Supabase Edge Function (ask-gemini) → Gemini API`                 |

**The Gemini API key is server-side only.** It is read from a Supabase secret
inside the Edge Function and never returned to a client. No key appears anywhere
under `apps/`. The function additionally enforces per-account rate limiting and
caps the model's thinking budget.

## Authentication

| Method            | Status                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| Email + password  | Implemented                                                                       |
| Google OAuth      | Implemented (PKCE via the system browser); appears once a client id is configured |
| Phone OTP         | Implemented behind `EXPO_PUBLIC_ENABLE_PHONE_OTP`; needs an SMS provider          |
| Guest / demo mode | Implemented; local-only, labelled on every screen, off unless explicitly enabled  |

## Build and deployment

| Technology         | Role                                                               |
| ------------------ | ------------------------------------------------------------------ |
| **EAS Build**      | Android APK builds — `preview` and `preview-live` profiles         |
| **Metro**          | Bundler, including platform-specific module resolution (`.web.ts`) |
| **GitHub Actions** | CI on every push to `main` and every pull request                  |

CI runs: format check → typecheck → tests with coverage thresholds → Deno tests
for the Edge Functions → an Android bundle build → a web bundle build.

## Development tooling

| Technology             | Version | Role                                        |
| ---------------------- | ------- | ------------------------------------------- |
| **Node.js**            | ≥ 22    | Toolchain runtime — **not the backend**     |
| **pnpm**               | 11.18   | Package manager and workspace orchestration |
| **Jest** + `jest-expo` | 29      | Mobile test runner                          |
| **Vitest**             | 4.1     | `packages/shared` test runner               |
| **Testing Library**    | 13.2    | React Native component testing              |
| **Deno**               | 2.x     | Edge Function runtime and test runner       |
| **Prettier**           | 3.4     | Formatting, enforced in CI                  |
| **better-sqlite3**     | 11.8    | Real SQLite in the Node test environment    |
| **Sharp**              | 0.35    | Logo asset generation                       |

## Documentation and version control

- **Markdown** and **Mermaid** for documentation and diagrams
- **Git** and **GitHub**, with CI gating every pull request

## Security posture

- Only `EXPO_PUBLIC_*` values reach the client bundle. The Supabase anon key is
  publishable and bounded by Row Level Security.
- The **service-role key** and the **Gemini key** exist only server-side.
- RLS is both `enable`d and `force`d on every table; policies cover select,
  insert and update, each scoped to `auth.uid()`.
- **No delete policy exists anywhere** — deletion is by tombstone, enforced at
  the database by the absence of the policy.
