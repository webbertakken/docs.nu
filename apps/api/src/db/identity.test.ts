import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePreviewOutbox } from '../routes/preview-outbox';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import {
  accountExists,
  deleteExpiredIdentityRows,
  deleteIdentity,
  deleteOldOutboxMail,
} from './identity';

let env: Env;
let sql: ReturnType<typeof sqliteD1>['sql'];
const iso = (ms: number) => new Date(ms).toISOString();
const NOW = Date.UTC(2026, 9, 25);

beforeEach(() => {
  ({ env, sql } = sqliteD1({ EMAIL_OUTBOX: '1' }));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  sql
    .prepare(
      "INSERT INTO identity_users (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES ('acct_a', 'A', 'a@b.co', 1, NULL, ?, ?)",
    )
    .run(iso(NOW), iso(NOW));
  const session = sql.prepare(
    "INSERT INTO identity_sessions (id, expiresAt, token, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, 'acct_a')",
  );
  session.run('s-live', iso(NOW + 1000), 't1', iso(NOW), iso(NOW));
  session.run('s-dead', iso(NOW - 1000), 't2', iso(NOW), iso(NOW));
  const code = sql.prepare(
    'INSERT INTO identity_verifications (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
  );
  code.run('v-live', 'sign-in-otp-a@b.co', 'h', iso(NOW + 1000), iso(NOW), iso(NOW));
  code.run('v-dead', 'sign-in-otp-x@y.co', 'h', iso(NOW - 1000), iso(NOW), iso(NOW));
});
afterEach(() => vi.restoreAllMocks());

describe('identity rows', () => {
  it('sweeps expired sessions and codes, nothing else', async () => {
    expect(await deleteExpiredIdentityRows(env, NOW)).toBe(2);
    expect(sql.prepare('SELECT id FROM identity_sessions').all()).toEqual([{ id: 's-live' }]);
    expect(sql.prepare('SELECT id FROM identity_verifications').all()).toEqual([{ id: 'v-live' }]);
  });

  it('deletes an account with its sessions and pending codes', async () => {
    expect(await accountExists(env, 'acct_a')).toBe(true);
    expect(await deleteIdentity(env, 'acct_a')).toBe(true);
    expect(await accountExists(env, 'acct_a')).toBe(false);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM identity_sessions').get()).toEqual({ n: 0 });
    expect(sql.prepare('SELECT id FROM identity_verifications').all()).toEqual([{ id: 'v-dead' }]);
    expect(await deleteIdentity(env, 'acct_a')).toBe(false);
  });
});

describe('the outbox', () => {
  const read = (to: string, e: Env = env) =>
    handlePreviewOutbox(new Request(`https://docs.test/api/preview/outbox?to=${to}`), e);

  it('reads back the newest message to an address, and sweeps a day-old one', async () => {
    const add = sql.prepare(
      "INSERT INTO email_outbox (to_address, subject, text, html, created_at) VALUES ('a@b.co', ?, '', '', ?)",
    );
    add.run('old', NOW - 90_000_000);
    add.run('new', NOW);
    const res = await read('A@b.co');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ subject: 'new' });
    expect(await deleteOldOutboxMail(env, NOW - 86_400_000)).toBe(1);
  });

  it('answers 404 for nothing kept, 400 without an address, and 404 off a preview', async () => {
    expect((await read('nobody@b.co')).status).toBe(404);
    expect((await read('')).status).toBe(400);
    expect((await read('a@b.co', { ...env, EMAIL_OUTBOX: undefined })).status).toBe(404);
    const post = new Request('https://docs.test/api/preview/outbox?to=a', { method: 'POST' });
    expect((await handlePreviewOutbox(post, env)).status).toBe(404);
  });
});
