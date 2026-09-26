import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';

/**
 * Links that come back from Supabase, and what they carry.
 *
 * A confirmation email points at Supabase's own `/verify` endpoint, which checks
 * the token and then sends the phone on to the address the sign-up asked for —
 * `preppilot://auth/callback`. What arrives there depends on the flow and on the
 * template the project uses, so all three shapes are read rather than betting on
 * one:
 *
 * - `?code=…` — PKCE. Exchanged for a session using the verifier held on this
 *   device, so an intercepted link alone grants nothing.
 * - `#access_token=…&refresh_token=…` — the implicit flow, which hands the
 *   session straight over.
 * - `?token_hash=…&type=signup` — a template that leaves verification to the
 *   app rather than doing it server-side first.
 *
 * Anything else is not ours: the app has one scheme and other links may open it.
 */
export type AuthLink =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'session'; readonly accessToken: string; readonly refreshToken: string }
  | { readonly kind: 'otp'; readonly tokenHash: string; readonly type: EmailOtpType }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'none' };

const EMAIL_OTP_TYPES: readonly string[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

/**
 * A link that has already been used, or sat in an inbox too long, is the common
 * failure and has a plain cause a student can act on. The rest are reported in
 * Supabase's own words rather than invented.
 */
function describeFailure(code: string | null, description: string | null): string {
  if (code === 'otp_expired') {
    return 'That email link has expired. Sign up or reset your password again to get a new one.';
  }
  if (code === 'access_denied') {
    return 'That email link has already been used. Try signing in.';
  }
  return description?.replace(/\+/g, ' ') ?? 'That email link did not work.';
}

/** Reads what a link carries, without touching the network. */
export function parseAuthLink(url: string): AuthLink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'none' };
  }

  // Supabase puts its answer in the query string or the fragment depending on
  // the flow, so both are searched rather than guessed at.
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const value = (name: string) => {
    const found = parsed.searchParams.get(name) ?? fragment.get(name);
    return found === null || found === '' ? null : found;
  };

  const failure = value('error') ?? value('error_code');
  if (failure !== null) {
    return {
      kind: 'failed',
      // `error_code` is the specific reason where there is one ("otp_expired");
      // `error` carries only the broad class. The specific one decides the
      // message, so it is preferred.
      message: describeFailure(value('error_code') ?? value('error'), value('error_description')),
    };
  }

  const code = value('code');
  if (code !== null) return { kind: 'code', code };

  const accessToken = value('access_token');
  const refreshToken = value('refresh_token');
  if (accessToken !== null && refreshToken !== null) {
    return { kind: 'session', accessToken, refreshToken };
  }

  const tokenHash = value('token_hash');
  const type = value('type');
  if (tokenHash !== null && type !== null && EMAIL_OTP_TYPES.includes(type)) {
    return { kind: 'otp', tokenHash, type: type as EmailOtpType };
  }

  return { kind: 'none' };
}

/**
 * The same links confirm a sign-up and reset a password, so the words fit both.
 * A reset link opened on a different phone lands here too: the code can only be
 * exchanged on the device that asked for it.
 */
const LINK_FAILED =
  'That email link did not work. Open it on the phone you asked from, or try signing in.';

export type AuthLinkOutcome = 'signedIn' | 'ignored' | 'failed';

/**
 * Turns a link into a session.
 *
 * The session is not returned: `onAuthStateChange` in the auth store is the one
 * place that records it, so a second path setting it would be a second truth.
 */
export async function completeAuthLink(
  link: AuthLink,
  client: SupabaseClient = getSupabase(),
): Promise<{ readonly outcome: AuthLinkOutcome; readonly message?: string }> {
  switch (link.kind) {
    case 'none':
      return { outcome: 'ignored' };

    case 'failed':
      return { outcome: 'failed', message: link.message };

    case 'code': {
      const { error } = await client.auth.exchangeCodeForSession(link.code);
      return error === null ? { outcome: 'signedIn' } : { outcome: 'failed', message: LINK_FAILED };
    }

    case 'session': {
      const { error } = await client.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      return error === null ? { outcome: 'signedIn' } : { outcome: 'failed', message: LINK_FAILED };
    }

    case 'otp': {
      const { error } = await client.auth.verifyOtp({
        token_hash: link.tokenHash,
        type: link.type,
      });
      return error === null ? { outcome: 'signedIn' } : { outcome: 'failed', message: LINK_FAILED };
    }
  }
}
