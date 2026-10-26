import { describe, expect, it } from 'vitest';
import { verifyOwnerId } from '../auth/owner-signature';
import type { Env } from '../types';
import { handleGuestId } from './guest-id';
import { makeTestRouteContext } from './test-route-context';

// POST /api/guest-id mints the guest id and its signature (docs/specs/014-identity/auth-and-guest-access.md
// "Signed guest ids").
const SIGN_IN = { BETTER_AUTH_SECRET: 's'.repeat(40) } as Env;

async function mint(env: Env) {
  const res = await handleGuestId(makeTestRouteContext('POST', '/api/guest-id', { env }));
  return await res.json<{ ownerId: string; ownerSig: string | null }>();
}

describe('POST /api/guest-id', () => {
  it('mints a fresh UUID with a signature the key verifies', async () => {
    const { ownerId, ownerSig } = await mint(SIGN_IN);
    expect(ownerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await verifyOwnerId(SIGN_IN, ownerId, ownerSig)).toBe(true);
    expect((await mint(SIGN_IN)).ownerId).not.toBe(ownerId);
  });

  it('mints an unsigned id on a guest-only host', async () => {
    expect((await mint({} as Env)).ownerSig).toBeNull();
  });

  it('answers only POST on its own path', async () => {
    for (const [method, path] of [
      ['GET', '/api/guest-id'],
      ['POST', '/api/guest-id/x'],
    ] as const) {
      const res = await handleGuestId(makeTestRouteContext(method, path, { env: SIGN_IN }));
      expect(res.status).toBe(404);
    }
  });
});
