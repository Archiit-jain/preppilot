/**
 * Where Supabase sends the phone after Google sign-in and after an email
 * confirmation link.
 *
 * A fixed string rather than `Linking.createURL('/auth/callback')`. In a
 * standalone build that call produces `preppilot:///auth/callback` — three
 * slashes, because the empty host still gets a leading slash — while the
 * address registered in Supabase's Redirect URLs has two. Supabase matches the
 * whole string, so it refused the app's address and fell back to the project's
 * Site URL, which by default is `http://localhost:3000`: Google sign-in and
 * email confirmation both finished on a page that does not exist on a phone.
 *
 * This must stay character-for-character identical to the entry under
 * Authentication → URL Configuration → Redirect URLs.
 */
export const AUTH_CALLBACK_URL = 'preppilot://auth/callback';
