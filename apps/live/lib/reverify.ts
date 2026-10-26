// Verifying again before something irreversible (docs/specs/014-identity/auth-and-guest-access.md "Sessions": deleting
// the account needs a session verified within the last ten minutes). The way back in is the same as the way in: a
// code to the account's email, which signs this browser in afresh. Works for every account, Google ones too, since
// every account has a verified email. better-auth's client is loaded only when someone gets this far.

import { authErrorCopy } from '@/lib/auth-errors';

// Sends a code to the account's email. Null when sent, else the sentence to show.
export async function sendReverifyCode(email: string): Promise<string | null> {
  try {
    const { authClient } = await import('@/lib/auth-client');
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    return error ? authErrorCopy(error) : null;
  } catch (err) {
    return authErrorCopy(err);
  }
}

// Signs this browser in again with the code, which makes the session fresh. Null on success, else the sentence.
export async function reverifyWithCode(email: string, otp: string): Promise<string | null> {
  try {
    const { authClient } = await import('@/lib/auth-client');
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    return error ? authErrorCopy(error) : null;
  } catch (err) {
    return authErrorCopy(err);
  }
}
