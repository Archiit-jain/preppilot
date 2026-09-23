import { Redirect } from 'expo-router';

/**
 * Where a Google sign-in or email confirmation link lands.
 *
 * The link opens the app, and the router tries to show a screen for its path.
 * Without this file that is "page not found" — shown to a student who has just
 * signed in successfully. The link itself is finished by `useAuthLinks` in
 * AuthGate; this only moves on, and the auth guards then send a signed-in
 * student to the tracker and anyone else to sign-in.
 */
export default function AuthCallbackRoute() {
  return <Redirect href="/" />;
}
