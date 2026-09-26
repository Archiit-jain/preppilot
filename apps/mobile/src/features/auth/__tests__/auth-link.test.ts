import type { SupabaseClient } from '@supabase/supabase-js';
import { completeAuthLink, parseAuthLink } from '../auth-link';

/**
 * A confirmation link is the one journey with no second chance: a student who
 * taps it and lands nowhere has no way to finish signing up. Supabase returns
 * its answer in three different shapes depending on flow and template, so all
 * three are read.
 */
describe('reading a link', () => {
  it('takes an authorisation code from the query string', () => {
    expect(parseAuthLink('preppilot://auth/callback?code=abc123')).toEqual({
      kind: 'code',
      code: 'abc123',
    });
  });

  it('takes a session pair from the fragment', () => {
    expect(
      parseAuthLink('preppilot://auth/callback#access_token=at&refresh_token=rt&type=signup'),
    ).toEqual({ kind: 'session', accessToken: 'at', refreshToken: 'rt' });
  });

  it('takes a token hash the app has to verify itself', () => {
    expect(parseAuthLink('preppilot://auth/callback?token_hash=hash123&type=signup')).toEqual({
      kind: 'otp',
      tokenHash: 'hash123',
      type: 'signup',
    });
  });

  it('refuses a type it does not recognise rather than passing it on', () => {
    expect(parseAuthLink('preppilot://auth/callback?token_hash=h&type=nonsense')).toEqual({
      kind: 'none',
    });
  });

  it('ignores a link that carries nothing of ours', () => {
    expect(parseAuthLink('preppilot://timer?subjectId=abc')).toEqual({ kind: 'none' });
    expect(parseAuthLink('not a url at all')).toEqual({ kind: 'none' });
  });

  /** The two failures a student actually meets, and what to do about each. */
  it('explains an expired link in terms of what to do next', () => {
    const link = parseAuthLink(
      'preppilot://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );

    expect(link).toEqual({
      kind: 'failed',
      message:
        'That email link has expired. Sign up or reset your password again to get a new one.',
    });
  });

  it('explains a link that was already used', () => {
    expect(parseAuthLink('preppilot://auth/callback?error=access_denied')).toEqual({
      kind: 'failed',
      message: 'That email link has already been used. Try signing in.',
    });
  });

  it('falls back to what the server said, in readable words', () => {
    expect(
      parseAuthLink(
        'preppilot://auth/callback?error=server_error&error_description=Database+error',
      ),
    ).toEqual({ kind: 'failed', message: 'Database error' });
  });
});

describe('finishing a link', () => {
  const clientWith = (auth: Record<string, unknown>) => ({ auth }) as unknown as SupabaseClient;
  const ok = { error: null };
  const failed = { error: { message: 'nope' } };

  it('exchanges a code for a session', async () => {
    const exchangeCodeForSession = jest.fn().mockResolvedValue(ok);
    const result = await completeAuthLink(
      { kind: 'code', code: 'abc' },
      clientWith({ exchangeCodeForSession }),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(result.outcome).toBe('signedIn');
  });

  it('installs a session handed over directly', async () => {
    const setSession = jest.fn().mockResolvedValue(ok);
    const result = await completeAuthLink(
      { kind: 'session', accessToken: 'at', refreshToken: 'rt' },
      clientWith({ setSession }),
    );

    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(result.outcome).toBe('signedIn');
  });

  it('verifies a token hash', async () => {
    const verifyOtp = jest.fn().mockResolvedValue(ok);
    const result = await completeAuthLink(
      { kind: 'otp', tokenHash: 'hash', type: 'signup' },
      clientWith({ verifyOtp }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash', type: 'signup' });
    expect(result.outcome).toBe('signedIn');
  });

  it('reports a refused exchange in words a student can act on', async () => {
    const result = await completeAuthLink(
      { kind: 'code', code: 'abc' },
      clientWith({ exchangeCodeForSession: jest.fn().mockResolvedValue(failed) }),
    );

    expect(result).toEqual({
      outcome: 'failed',
      message:
        'That email link did not work. Open it on the phone you asked from, or try signing in.',
    });
  });

  it('passes a parse failure through untouched', async () => {
    const result = await completeAuthLink(
      { kind: 'failed', message: 'That confirmation link has expired.' },
      clientWith({}),
    );

    expect(result).toEqual({ outcome: 'failed', message: 'That confirmation link has expired.' });
  });

  it('leaves an unrelated link alone', async () => {
    expect(await completeAuthLink({ kind: 'none' }, clientWith({}))).toEqual({
      outcome: 'ignored',
    });
  });
});
