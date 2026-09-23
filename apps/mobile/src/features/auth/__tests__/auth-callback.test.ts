import { AUTH_CALLBACK_URL } from '../auth-callback';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const appConfig = require('../../../../app.json') as { expo: { scheme: string } };

/**
 * The address has to match Supabase's Redirect URLs entry exactly. When it did
 * not, Google sign-in and email confirmation both ended on localhost.
 */
describe('the sign-in return address', () => {
  it('uses the scheme the app registers with Android', () => {
    expect(AUTH_CALLBACK_URL.startsWith(`${appConfig.expo.scheme}://`)).toBe(true);
  });

  it('has exactly two slashes after the scheme, as registered in Supabase', () => {
    expect(AUTH_CALLBACK_URL).toBe('preppilot://auth/callback');
    expect(AUTH_CALLBACK_URL).not.toMatch(/:\/\/\//);
  });
});
