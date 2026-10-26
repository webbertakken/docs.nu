import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { signOwnerId, verifyOwnerId } from './owner-signature';

const SIGN_IN = { BETTER_AUTH_SECRET: 's'.repeat(40) } as Env;
const OTHER = { BETTER_AUTH_SECRET: 't'.repeat(40) } as Env;
const GUEST_ONLY = {} as Env;

describe('owner-signature', () => {
  it('signs an id and verifies its own signature', async () => {
    const id = 'guest-abc';
    const sig = await signOwnerId(SIGN_IN, id);
    expect(sig).toBeTruthy();
    expect(await verifyOwnerId(SIGN_IN, id, sig)).toBe(true);
  });

  it('is deterministic for the same id and key', async () => {
    expect(await signOwnerId(SIGN_IN, 'x')).toBe(await signOwnerId(SIGN_IN, 'x'));
  });

  it("rejects another id's signature", async () => {
    const sigForA = await signOwnerId(SIGN_IN, 'id-A');
    expect(await verifyOwnerId(SIGN_IN, 'id-B', sigForA)).toBe(false);
  });

  it('rejects a signature minted under a different secret', async () => {
    const sig = await signOwnerId(OTHER, 'id');
    expect(await verifyOwnerId(SIGN_IN, 'id', sig)).toBe(false);
  });

  it('rejects a missing or empty signature', async () => {
    expect(await verifyOwnerId(SIGN_IN, 'id', null)).toBe(false);
    expect(await verifyOwnerId(SIGN_IN, 'id', undefined)).toBe(false);
    expect(await verifyOwnerId(SIGN_IN, 'id', '')).toBe(false);
  });

  it('signs nothing on a guest-only host, and verifies nothing there', async () => {
    expect(await signOwnerId(GUEST_ONLY, 'id')).toBeNull();
    const sig = await signOwnerId(SIGN_IN, 'id');
    expect(await verifyOwnerId(GUEST_ONLY, 'id', sig)).toBe(false);
  });
});
