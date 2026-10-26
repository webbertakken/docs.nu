import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/migrate moves a guest's rows into the account a session token proves (docs/specs/014-identity/
// auth-and-guest-access.md "Guest → account upgrade"). These cases pin who may ask, and that the guest id must be
// proven with its signature before anything moves.

const { migrateOwnerId } = vi.hoisted(() => ({ migrateOwnerId: vi.fn() }));
vi.mock('../db', () => ({ migrateOwnerId }));

import { signOwnerId } from '../auth/owner-signature';
import type { Env } from '../types';
import { handleMigrate } from './migrate';
import { makeTestRouteContext } from './test-route-context';

const SIGN_IN = { BETTER_AUTH_SECRET: 's'.repeat(40) } as Env;
const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const ACCOUNT = 'acct_me000000000000000000000';

async function migrate(opts: {
  account?: string | null;
  body?: unknown;
  env?: Env;
  owner?: string;
}): Promise<Response> {
  const ctx = makeTestRouteContext('POST', '/api/migrate', {
    env: opts.env ?? SIGN_IN,
    owner: opts.owner ?? opts.account ?? undefined,
    body: opts.body,
  });
  ctx.sessionAccountId = opts.account === undefined ? ACCOUNT : opts.account;
  return handleMigrate(ctx);
}

const signed = async (id = GUEST) => ({
  guestOwnerId: id,
  guestSignature: await signOwnerId(SIGN_IN, id),
});

beforeEach(() => {
  migrateOwnerId.mockReset();
  migrateOwnerId.mockResolvedValue({ documents: 2, folders: 1, shared: 0, images: 3 });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/migrate', () => {
  it("moves a signed guest's rows into the session's account", async () => {
    const res = await migrate({ body: await signed() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      migrated: { documents: 2, folders: 1, shared: 0, images: 3 },
    });
    expect(migrateOwnerId).toHaveBeenCalledWith(expect.anything(), GUEST, ACCOUNT);
    expect(console.info).toHaveBeenCalledWith('[migrate] moved rows=6');
  });

  it('moves nothing when the guest id is the account itself', async () => {
    const res = await migrate({ body: { guestOwnerId: ACCOUNT } });
    expect(await res.json()).toEqual({
      migrated: { documents: 0, folders: 0, shared: 0, images: 0 },
    });
    expect(migrateOwnerId).not.toHaveBeenCalled();
  });

  it('refuses a caller with no session, whatever guest header it sends', async () => {
    const res = await migrate({ account: null, owner: GUEST, body: await signed() });
    expect(res.status).toBe(400);
    expect(migrateOwnerId).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[migrate] refused reason=no_session');
  });

  it('requires the guest id', async () => {
    for (const body of [{}, { guestOwnerId: '  ' }, { guestOwnerId: 42 }, null, 'x']) {
      const res = await migrate({ body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(migrateOwnerId).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[migrate] refused reason=no_guest_id');
  });

  it('refuses an account id as the source', async () => {
    const res = await migrate({ body: await signed('acct_victim00000000000000000') });
    expect(res.status).toBe(403);
    expect(migrateOwnerId).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[migrate] refused reason=account_id');
  });

  it("refuses a guest id without its signature, or with another id's", async () => {
    const other = await signed('7d2c1b8e-3f4a-4c5d-9e6f-0a1b2c3d4e5f');
    for (const guestSignature of [undefined, null, '', 7, 'bogus', other.guestSignature]) {
      const res = await migrate({ body: { guestOwnerId: GUEST, guestSignature } });
      expect(res.status, String(guestSignature)).toBe(403);
    }
    expect(migrateOwnerId).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[migrate] refused reason=signature');
  });

  it('refuses a signature made under another secret', async () => {
    const elsewhere = { BETTER_AUTH_SECRET: 't'.repeat(40) } as Env;
    const guestSignature = await signOwnerId(elsewhere, GUEST);
    const res = await migrate({ body: { guestOwnerId: GUEST, guestSignature } });
    expect(res.status).toBe(403);
  });

  it('answers only POST on its own path', async () => {
    const ctx = makeTestRouteContext('GET', '/api/migrate', { env: SIGN_IN });
    ctx.sessionAccountId = ACCOUNT;
    expect((await handleMigrate(ctx)).status).toBe(404);
    const deeper = makeTestRouteContext('POST', '/api/migrate/x', { env: SIGN_IN });
    deeper.sessionAccountId = ACCOUNT;
    expect((await handleMigrate(deeper)).status).toBe(404);
  });
});
