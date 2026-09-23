import type { SupabaseClient } from '@supabase/supabase-js';
import { statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleSignInError,
  forgetGoogleAccount,
  signInWithGoogle,
  type GoogleAccountPicker,
} from '../google';

const WEB_CLIENT_ID = '407761784542-web.apps.googleusercontent.com';

/** A Google account picker that answers however a test tells it to. */
function picker(signIn: GoogleAccountPicker['signIn']) {
  return {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(signIn),
  } as unknown as GoogleAccountPicker & {
    configure: jest.Mock;
    hasPlayServices: jest.Mock;
    signIn: jest.Mock;
  };
}

const success = (idToken: string | null) => async () =>
  ({
    type: 'success',
    data: { idToken, user: { email: 'ada@example.com' } },
  }) as never;

function supabase(result: { error: unknown } = { error: null }) {
  const signInWithIdToken = jest.fn().mockResolvedValue(result);
  const client = (() => ({ auth: { signInWithIdToken } })) as unknown as () => SupabaseClient;
  return { client, signInWithIdToken };
}

const run = (google: GoogleAccountPicker, client = supabase().client) =>
  signInWithGoogle({ google, client, webClientId: () => WEB_CLIENT_ID });

/**
 * The browser flow showed "continue to <project>.supabase.co" and then lost the
 * student on localhost. The native picker names the app and returns a token
 * directly, with no redirect to get wrong.
 */
describe('signing in with Google', () => {
  it('hands the Google token to Supabase and signs in', async () => {
    const google = picker(success('google-id-token'));
    const { client, signInWithIdToken } = supabase();

    await expect(run(google, client)).resolves.toBe('signedIn');

    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
  });

  /** Supabase checks the token's audience against the web client, not the Android one. */
  it('asks Google for a token meant for the web client', async () => {
    const google = picker(success('token'));

    await run(google);

    expect(google.configure).toHaveBeenCalledWith({ webClientId: WEB_CLIENT_ID });
  });

  it('checks Play Services first and offers to update them', async () => {
    const google = picker(success('token'));

    await run(google);

    expect(google.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  });

  it('passes on a rejection from Supabase', async () => {
    const refused = { message: 'Invalid token audience' };
    const { client } = supabase({ error: refused });

    await expect(run(picker(success('token')), client)).rejects.toBe(refused);
  });
});

describe('backing out', () => {
  it('is a cancellation, not a failure, when the sheet is closed', async () => {
    const google = picker(async () => ({ type: 'cancelled', data: null }) as never);
    const { client, signInWithIdToken } = supabase();

    await expect(run(google, client)).resolves.toBe('cancelled');
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it('is a cancellation when it arrives as an error code', async () => {
    const google = picker(async () => {
      throw Object.assign(new Error('cancelled'), { code: statusCodes.SIGN_IN_CANCELLED });
    });

    await expect(run(google)).resolves.toBe('cancelled');
  });

  it('is a cancellation when a second tap lands while the sheet is open', async () => {
    const google = picker(async () => {
      throw Object.assign(new Error('busy'), { code: statusCodes.IN_PROGRESS });
    });

    await expect(run(google)).resolves.toBe('cancelled');
  });
});

describe('failures the student can act on', () => {
  it('names a missing or outdated Play Services', async () => {
    const google = picker(async () => {
      throw Object.assign(new Error('no play services'), {
        code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
      });
    });

    await expect(run(google)).rejects.toMatchObject({ code: 'google_play_services' });
  });

  /** DEVELOPER_ERROR: no Android client matches this package and signing key. */
  it('says the build is not set up when Google does not recognise the app', async () => {
    const google = picker(async () => {
      throw Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' });
    });

    await expect(run(google)).rejects.toMatchObject({ code: 'google_not_configured' });
  });

  it('refuses to start without a web client ID', async () => {
    const google = picker(success('token'));

    await expect(
      signInWithGoogle({ google, client: supabase().client, webClientId: () => null }),
    ).rejects.toBeInstanceOf(GoogleSignInError);
    expect(google.signIn).not.toHaveBeenCalled();
  });

  it('refuses a success that carries no token', async () => {
    const { client, signInWithIdToken } = supabase();

    await expect(run(picker(success(null)), client)).rejects.toMatchObject({
      code: 'google_no_token',
    });
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it('passes on anything it does not recognise untouched', async () => {
    const odd = new Error('something else');
    const google = picker(async () => {
      throw odd;
    });

    await expect(run(google)).rejects.toBe(odd);
  });
});

describe('forgetting the account on sign-out', () => {
  it('asks Google to forget it, so the picker appears next time', async () => {
    const signOut = jest.fn().mockResolvedValue(null);

    await forgetGoogleAccount({ signOut });

    expect(signOut).toHaveBeenCalled();
  });

  it('never makes sign-out fail', async () => {
    const signOut = jest.fn().mockRejectedValue(new Error('no play services'));

    await expect(forgetGoogleAccount({ signOut })).resolves.toBeUndefined();
  });
});
