# Security

What is actually enforced, and what is not.

## Row Level Security

Every table holding student data has RLS enabled and **forced** — forcing applies
the policies to the table owner too, closing the default hole where a privileged
role bypasses them.

Every policy scopes to `auth.uid()`. There is no delete policy anywhere, and no
delete grant: rows are tombstoned, so nothing in the system can hard-delete a row.

RLS is the only enforcement point a modified client cannot bypass. The app never
adds a `user_id` filter of its own — the server is what scopes the data, and the
client could not widen access if it tried.

**Verified**, not assumed. Against a real Postgres: one account cannot see
another's rows, an attempt to insert a row owned by another user is rejected by
policy, and `DELETE` is refused.

### The bug worth remembering

The first version enabled RLS and wrote policies but never granted table
privileges. RLS filters rows only after the privilege check passes, so every
request was rejected outright.

It was invisible until the SQL ran against a real database. Any new table needs
its grant, and `supabase db reset` against the local stack is the cheapest way to
find out.

## Secrets

| Secret                    | Where it lives                             | Why that is safe                     |
| ------------------------- | ------------------------------------------ | ------------------------------------ |
| Supabase publishable key  | `.env`, compiled into the bundle           | Publishable by design; RLS bounds it |
| Supabase service-role key | **Nowhere in this repo**                   | Would bypass RLS entirely            |
| Gemini API key            | Supabase secret, read by the Edge Function | Never sent to a client               |

`.env` is gitignored. `.env.example` carries placeholders and states which keys
must never appear.

Only `EXPO_PUBLIC_*` values may be read by the app: everything under that prefix
is compiled into the bundle and readable by anyone who downloads it. That is
acceptable for a publishable key and unacceptable for anything else.

## Sessions

Stored in the device keystore via `expo-secure-store`, never in plain storage — a
refresh token grants access to the account.

`expo-secure-store` rejects values over 2048 bytes and a Supabase session
routinely exceeds that, so the adapter chunks. It splits on code-point boundaries
while budgeting by UTF-8 byte length, cleans up orphaned chunks when a session
shrinks, and discards a partially written entry rather than returning a session
that fails to parse and wedges start-up.

Token refresh pauses while the app is backgrounded, where the OS can suspend the
process mid-request and leave the stored session half-written.

## Sign-in flows

- **PKCE** is the Supabase auth flow, so an email confirmation link carries a
  one-time code rather than tokens in the URL. The link returns to
  `preppilot://auth/callback`, and the app exchanges the code itself.
- **Google** sign-in is native: the Google ID token from Android's account
  picker is verified by Supabase (`signInWithIdToken`). The Web client's secret
  lives only in Supabase's provider settings, never in the app. Google issues a
  token only to an app signed with a key registered in the Android OAuth client.
- **Signing out** also clears the Google account choice on the device, so the
  next Google sign-in shows the picker rather than silently reusing an account.

## Input validation

Validated in `packages/shared/src/auth/validation.ts` before any request. Passwords
cap at 72 **bytes**, not characters: bcrypt silently ignores everything past byte
72, so a longer password would let someone change its tail and find the old one
still worked.

## Errors never leak

No raw server or driver error reaches a screen. There are tests asserting that a
leaked key in an error message, a PostgREST constraint name, and `SQLITE_CORRUPT`
all fail to appear in rendered output.

## What is _not_ protected

- **The local database is not encrypted.** Someone with a rooted device and
  physical access can read a student's syllabus. The session token is in the
  keystore; the syllabus is not.
- **Demo mode has no authentication at all.** It is gated behind an explicit flag,
  but anything stored in it is unprotected, and since the demo banner was removed
  (D92) nothing on screen says so.
- **Pictures sent to the assistant leave the device.** They go to the Edge
  Function and on to Google's Gemini API, and are not stored by PrepPilot. The
  function refuses any file that is not a JPEG, PNG, WebP or HEIC image, or that
  exceeds its size limit, before calling Gemini.
- **The Edge Function's rate limit is in-memory**, so it resets when the function
  cold-starts. A durable limit belongs in the database once usage justifies it.
- **No penetration testing has been done.** The RLS claims above are verified by
  the tests described; they are not a security audit.
