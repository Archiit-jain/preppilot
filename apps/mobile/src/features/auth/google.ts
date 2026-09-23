import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../config/env';
import { getSupabase } from '../../lib/supabase';

/**
 * Backing out of the Google sheet is not a failure, and must not be reported as
 * one — a student who changed their mind did nothing wrong.
 */
export type GoogleSignInOutcome = 'signedIn' | 'cancelled';

/** The part of the native module this file uses, so tests can stand in for it. */
export type GoogleAccountPicker = Pick<
  typeof GoogleSignin,
  'configure' | 'hasPlayServices' | 'signIn'
>;

export interface GoogleSignInDependencies {
  readonly client: () => SupabaseClient;
  readonly webClientId: () => string | null;
  readonly google: GoogleAccountPicker;
}

const defaults: GoogleSignInDependencies = {
  client: getSupabase,
  webClientId: () => getEnv().googleWebClientId,
  google: GoogleSignin,
};

/**
 * A failure a student can do something about, carried with a code the auth
 * error table knows, so the message on screen is written for them.
 */
export class GoogleSignInError extends Error {
  constructor(
    readonly code: 'google_play_services' | 'google_not_configured' | 'google_no_token',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

/**
 * Signs in with Google using Android's own account picker.
 *
 * The browser flow this replaces sent the student to a Google page that said
 * "continue to lqgekguhqggiagrzwfvk.supabase.co" — the address of the server
 * handling the redirect — and then depended on a redirect back into the app.
 * The native picker names the app instead, and hands back a Google ID token
 * directly, so there is no redirect to lose: the token is given to Supabase,
 * which checks it was issued for this project's Google client.
 *
 * Google only issues that token to an app it recognises, by package name and
 * signing certificate, so an Android OAuth client must exist for them in the
 * same Google Cloud project as the web client. Without it the picker fails with
 * DEVELOPER_ERROR (see docs/developer/GOOGLE_SIGN_IN.md).
 */
export async function signInWithGoogle(
  dependencies: Partial<GoogleSignInDependencies> = {},
): Promise<GoogleSignInOutcome> {
  const { client, webClientId, google } = { ...defaults, ...dependencies };

  const clientId = webClientId();
  if (clientId === null) {
    throw new GoogleSignInError(
      'google_not_configured',
      'Google sign-in is not set up for this build.',
    );
  }

  // The web client's ID, not the Android one: it is the audience Supabase
  // checks the returned token against. Safe to call on every sign-in.
  google.configure({ webClientId: clientId });

  let response: Awaited<ReturnType<GoogleAccountPicker['signIn']>>;
  try {
    await google.hasPlayServices({ showPlayServicesUpdateDialog: true });
    response = await google.signIn();
  } catch (error) {
    // A second tap while the sheet is still open, or the student closing it on
    // an older Play Services, arrives as an error rather than a cancelled
    // response. Either way they stopped; nothing failed.
    if (
      isErrorWithCode(error) &&
      (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)
    ) {
      return 'cancelled';
    }
    throw translate(error);
  }

  if (isCancelledResponse(response)) return 'cancelled';

  const idToken = response.data.idToken;
  if (idToken === null || idToken === '') {
    throw new GoogleSignInError(
      'google_no_token',
      'Google did not confirm your account. Try again.',
    );
  }

  const { error } = await client().auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error !== null) throw error;

  return 'signedIn';
}

/** Turns the native module's failures into ones the sign-in screen can explain. */
function translate(error: unknown): unknown {
  if (!isErrorWithCode(error)) return error;

  if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new GoogleSignInError(
      'google_play_services',
      'Google Play services is missing or out of date on this phone.',
    );
  }

  // Google's own name for "this app is not registered with this Google Cloud
  // project": no Android OAuth client matches the package and signing key.
  if (String(error.code) === '10' || /DEVELOPER_ERROR/i.test(error.message)) {
    return new GoogleSignInError(
      'google_not_configured',
      'Google sign-in is not set up for this build.',
    );
  }

  return error;
}

/**
 * Forgets the Google account chosen on this device.
 *
 * Google remembers the last account, so without this the next "Continue with
 * Google" would sign straight back into it with no picker — the wrong account on
 * a shared phone, and no way to choose another. Best effort: a student who
 * never used Google has nothing to forget, and sign-out must not fail on it.
 */
export async function forgetGoogleAccount(
  google: Pick<typeof GoogleSignin, 'signOut'> = GoogleSignin,
): Promise<void> {
  try {
    await google.signOut();
  } catch {
    // Nothing remembered, or no Play Services: either way there is nothing to do.
  }
}
