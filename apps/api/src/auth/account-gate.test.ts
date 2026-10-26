import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { ADMINISTRATION_SEGMENTS, requireAccount } from './account-gate';

const LIVE = 'acct_live00000000000000000000';
const GONE = 'acct_gone00000000000000000000';

function hostWithAccount() {
  const { env, sql } = sqliteD1({});
  const now = new Date().toISOString();
  sql
    .prepare(
      'INSERT INTO identity_users (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
    )
    .run(LIVE, 'Ada', 'ada@example.com', now, now);
  return env;
}

afterEach(() => vi.restoreAllMocks());

describe('requireAccount', () => {
  it('lets an existing account administer', async () => {
    expect(await requireAccount(hostWithAccount(), LIVE, 'tokens')).toBeNull();
  });

  it("refuses a deleted account's session on every administration route", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = hostWithAccount();
    for (const segment of ADMINISTRATION_SEGMENTS) {
      const res = await requireAccount(env, GONE, segment);
      expect(res?.status, segment).toBe(401);
      expect(await res?.json()).toEqual({ error: 'account_not_found' });
      expect(warn).toHaveBeenCalledWith(`[auth] account_not_found route=${segment}`);
    }
  });

  it('reads nothing for a content route', async () => {
    const env = hostWithAccount();
    const prepare = vi.spyOn(env.DB, 'prepare');
    expect(await requireAccount(env, GONE, 'documents')).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
});
