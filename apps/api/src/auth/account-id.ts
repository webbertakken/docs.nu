// An account's owner id (docs/specs/014-identity/auth-and-guest-access.md "Who is who"): `acct_` and 24 base62
// characters, about 143 bits. Never a UUID, the guest id's shape, so one prefix test tells the two apart
// (`isAccountIdShape` in @livediagram/api-schema).
import { ACCOUNT_ID_PREFIX } from '@livediagram/api-schema';

export const ACCOUNT_ID_RANDOM_LENGTH = 24;

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// The largest multiple of 62 below 256: a byte at or above it is drawn again, so every character is equally likely.
const UNBIASED_LIMIT = 248;

export function generateAccountId(): string {
  let out = ACCOUNT_ID_PREFIX;
  while (out.length < ACCOUNT_ID_PREFIX.length + ACCOUNT_ID_RANDOM_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ACCOUNT_ID_RANDOM_LENGTH))) {
      if (byte >= UNBIASED_LIMIT) continue;
      out += ALPHABET[byte % 62];
      if (out.length === ACCOUNT_ID_PREFIX.length + ACCOUNT_ID_RANDOM_LENGTH) break;
    }
  }
  return out;
}
