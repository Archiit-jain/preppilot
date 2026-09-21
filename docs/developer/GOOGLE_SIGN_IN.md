# Turning on "Continue with Google"

The button and its sign-in flow are already written and tested
(`features/auth/components/auth-alternatives.tsx`, `features/auth/google.ts`).
They are hidden, not missing: `features.googleSignIn` is true only when
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was set **at build time** (D26 — a flow that
cannot work must not reach a student as a broken button).

Three things have to line up. Two of them are accounts nobody else can hold on
your behalf, so steps 1 and 2 are yours; step 3 is the build.

| Where        | What                                                              |
| ------------ | ----------------------------------------------------------------- |
| Google Cloud | An OAuth consent screen and a Web client                          |
| Supabase     | The Google provider switched on, with that client's ID and secret |
| EAS          | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` as an environment variable     |

## 1. Google Cloud — create the OAuth client

1. Open <https://console.cloud.google.com/> and select a project, or create one
   (any name; it is only a container).
2. **APIs & Services → OAuth consent screen**.
   - User type **External**, then **Create**.
   - App name `PrepPilot`, your email as both support and developer contact.
   - Scopes: leave the defaults. Google adds `email`, `profile` and `openid`,
     which is all the app reads.
   - **Test users**: add the Google address you will sign in with. While the
     app is in _Testing_, only these addresses can sign in — everyone else is
     refused with `access_denied`, which looks like a bug and is not one.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**. Not "Android" — the flow goes
     through Supabase's callback, which is a web URL, and an Android client has
     no client secret for Supabase to use.
   - Name: `PrepPilot web client`.
   - **Authorised redirect URIs → Add URI**, exactly:

     ```
     https://lqgekguhqggiagrzwfvk.supabase.co/auth/v1/callback
     ```

   - **Create**. Copy the **Client ID** and **Client secret**.

## 2. Supabase — switch the provider on

1. Dashboard → your project → **Authentication → Sign In / Providers → Google**.
2. Enable it, paste the **Client ID** and **Client secret**, **Save**.
   (Until this is done the project reports `"google": false` and every attempt
   fails at Supabase rather than at Google.)
3. **Authentication → URL Configuration → Redirect URLs**, add:

   ```
   preppilot://auth/callback
   ```

   This is where the app is sent back to after Google approves. It is the same
   URL `Linking.createURL('/auth/callback')` produces in a standalone build, and
   Supabase refuses to redirect anywhere not on this list.

## 3. The build — make the button appear

`EXPO_PUBLIC_*` values are inlined while the build runs on EAS servers, so this
belongs to the Expo project, not to a GitHub secret:

```bash
cd apps/mobile
eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
  --value <the client ID from step 1> --visibility sensitive
```

Then rebuild: `pnpm apk:live`, or the **Android APK** workflow from the Actions
tab with profile `preview-live`.

## Checking it worked

- The sign-in screen shows **Continue with Google** above the phone option.
- Tapping it opens a Google account chooser, and returns to PrepPilot signed in.
- `https://<project>.supabase.co/auth/v1/settings` reports `"google": true`.

## When it fails

| What you see                          | Why                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| No button at all                      | The build had no `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`                                                    |
| `access_denied`                       | The Google account is not a test user on a consent screen still in Testing                             |
| `redirect_uri_mismatch`               | The Supabase callback URL in step 1 does not match exactly, including `https://` and no trailing slash |
| Google succeeds, app stays signed out | `preppilot://auth/callback` is missing from Supabase's Redirect URLs                                   |
| Works in the browser build            | It will not: the web build cannot hold a session at all (see LIMITATIONS.md)                           |

## What this does not cover

Google sign-in on the **web** build. Sessions there have nowhere safe to live,
so the browser build refuses real accounts entirely; this is for the Android app.
