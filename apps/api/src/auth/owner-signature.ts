// HMAC-SHA256 signature over a guest owner-id (docs/specs/014-identity/auth-and-guest-access.md "Signed guest ids").
//
// Why: a guest's owner-id (the `X-Owner-Id` UUID) is a bearer value that
// leaks — it rides in document DTOs and realtime presence frames. Without
// a signature, anyone who *observed* a guest's id could act as that guest
// or claim all of that guest's documents into their own account. The
// signature binds possession to a key the observer can't have:
//
//   - The signature is minted server-side at POST /api/guest-id, where the
//     SERVER chooses the id. A caller can therefore only ever hold a
//     signature for an id we handed *them* — never for an id they merely
//     saw elsewhere.
//   - The signature is never returned in any DTO or presence frame; only
//     the bare id is. So observing the id does not reveal the signature.
//   - Owner-scoped routes, the room's owner leg and /api/migrate verify it.
//
// The key is derived from the sign-in secret (auth/guest-key.ts). A host
// without one signs nothing: `signOwnerId` returns null there.

import { bytesToBase64Url } from '@livedoc/api-schema';
import type { Env } from '../types';
import { guestSigningKey } from './guest-key';
import { timingSafeEqual } from './timing-safe';

const enc = new TextEncoder();

async function hmacSign(key: CryptoKey, ownerId: string): Promise<string> {
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(ownerId)));
}

// Sign `ownerId`; null on a host with no guest signing key.
export async function signOwnerId(env: Env, ownerId: string): Promise<string | null> {
  const key = await guestSigningKey(env);
  return key ? hmacSign(key, ownerId) : null;
}

// Constant-time verify of `sig` against `ownerId`. Fails closed: a missing or
// mismatched signature is false, and so is any signature on a host with no key
// (nothing there was ever signed). Callers that let a guest-only host through
// decide that before asking (auth/guest-rest.ts guestSignatureEnforced).
export async function verifyOwnerId(
  env: Env,
  ownerId: string,
  sig: string | null | undefined,
): Promise<boolean> {
  const key = await guestSigningKey(env);
  if (!key || !sig) return false;
  return timingSafeEqual(await hmacSign(key, ownerId), sig);
}
