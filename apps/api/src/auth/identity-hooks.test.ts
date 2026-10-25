import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { identityHooks, sendSignInCode, SIGN_UP_SESSION_WINDOW_MS } from './identity-hooks';

const reportServerEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../server-telemetry', () => ({ reportServerEvent }));
const welcomeOnSighting = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../email/lifecycle', () => ({ welcomeOnSighting }));

let env: Env;
let sql: ReturnType<typeof sqliteD1>['sql'];
let pending: Promise<unknown>[];
const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };

function addUser(id: string, createdAt: number) {
  sql
    .prepare(
      'INSERT INTO identity_users (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, 1, NULL, ?, ?)',
    )
    .run(
      id,
      'A',
      `${id}@example.com`,
      new Date(createdAt).toISOString(),
      new Date(createdAt).toISOString(),
    );
}

beforeEach(() => {
  ({ env, sql } = sqliteD1({ EMAIL_OUTBOX: '1' }));
  pending = [];
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  reportServerEvent.mockClear();
  welcomeOnSighting.mockClear();
});

describe('identityHooks', () => {
  it('counts a sign-up and welcomes the new account, off the response path', async () => {
    await identityHooks(env, ctx).user.create.after({ id: 'acct_x', email: 'Ada@Example.com' });
    await Promise.all(pending);
    expect(reportServerEvent).toHaveBeenCalledWith(env, 'Session', 'SignedUp');
    expect(welcomeOnSighting).toHaveBeenCalledWith(env, 'acct_x', 'ada@example.com');
  });

  it('counts a sign-in, but not the session a sign-up makes', async () => {
    addUser('acct_old', Date.now() - SIGN_UP_SESSION_WINDOW_MS - 1000);
    addUser('acct_new', Date.now());
    const hooks = identityHooks(env, ctx);
    await hooks.session.create.after({ userId: 'acct_new' });
    await hooks.session.create.after({ userId: 'acct_old' });
    await hooks.session.create.after({ userId: 'acct_gone' });
    await Promise.all(pending);
    expect(reportServerEvent).toHaveBeenCalledTimes(1);
    expect(reportServerEvent).toHaveBeenCalledWith(env, 'Session', 'SignedIn');
  });

  it('runs inline without an execution context, and never throws into the sign-in', async () => {
    reportServerEvent.mockRejectedValueOnce(new Error('down'));
    await identityHooks(env).user.create.after({ id: 'acct_x', email: 'a@b.c' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(console.error).toHaveBeenCalledWith(
      '[auth] hook_failed hook=user.create.after',
      expect.any(Error),
    );
  });

  it('keeps no provider token on a sign-in method', async () => {
    const hooks = identityHooks(env);
    const account = { providerId: 'google', accessToken: 'a', refreshToken: 'r', idToken: 'i' };
    expect(await hooks.account.create.before(account)).toEqual({
      data: { providerId: 'google', accessToken: null, refreshToken: null, idToken: null },
    });
    expect(await hooks.account.update.before(account)).toEqual({
      data: { providerId: 'google', accessToken: null, refreshToken: null, idToken: null },
    });
  });
});

describe('sendSignInCode', () => {
  it('sends the code and answers true', async () => {
    expect(await sendSignInCode(env, { email: 'a@b.c', otp: '123456' })).toBe(true);
    const row = sql.prepare('SELECT subject FROM email_outbox').get() as { subject: string };
    expect(row.subject).toBe('123456 is your LiveDoc code');
  });

  it('answers false when the transport fails', async () => {
    const failing = { ...env, EMAIL_OUTBOX: undefined } as Env;
    expect(await sendSignInCode(failing, { email: 'a@b.c', otp: '123456' })).toBe(false);
    expect(console.error).toHaveBeenCalledWith('[auth] code_send_failed status=not_configured');
  });
});
