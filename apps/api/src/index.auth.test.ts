import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { resetSessionKeyCache } from './auth/session-token';
import { sqliteD1 } from './test-sqlite-d1';
import type { Env } from './types';

// The whole front door with sign-in on (docs/specs/014-identity/auth-and-guest-access.md "How the api knows who is
// calling"), over a real SQLite D1 with every migration: a code from the outbox, a session cookie, a session
// token, and the api treating that token as the account.
const ORIGIN = 'https://docs.test';
const SIGN_IN = { BETTER_AUTH_SECRET: 's'.repeat(40), APP_BASE_URL: ORIGIN, EMAIL_OUTBOX: '1' };

let env: Env;
let sql: ReturnType<typeof sqliteD1>['sql'];

function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  headers.set('Origin', ORIGIN);
  return worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), env);
}

async function signIn(email: string): Promise<{ cookie: string; token: string; id: string }> {
  await call('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const mail = (await (await call(`/api/preview/outbox?to=${email}`)).json()) as {
    subject: string;
  };
  const res = await call('/api/auth/sign-in/email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp: mail.subject.slice(0, 6), name: 'Ada' }),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const { user } = (await res.json()) as { user: { id: string } };
  const { token } = (await (
    await call('/api/auth/token', { headers: { Cookie: cookie } })
  ).json()) as {
    token: string;
  };
  return { cookie, token, id: user.id };
}

beforeEach(() => {
  ({ env, sql } = sqliteD1(SIGN_IN));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetSessionKeyCache();
  vi.restoreAllMocks();
});

describe('sign-in at the front door', () => {
  it('reports the methods in the capabilities', async () => {
    const caps = (await (await call('/api/capabilities')).json()) as Record<string, unknown>;
    expect(caps).toMatchObject({
      authEnabled: true,
      signInMethods: ['email-code'],
      googleClientId: null,
    });
  });

  it('serves no /api/auth and no outbox on a host with no keys', async () => {
    env = sqliteD1({}).env;
    expect((await call('/api/auth/get-session')).status).toBe(404);
    expect((await call('/api/preview/outbox?to=a@b.c')).status).toBe(404);
    const caps = (await (await call('/api/capabilities')).json()) as Record<string, unknown>;
    expect(caps).toMatchObject({ authEnabled: false, signInMethods: [] });
  });

  it('treats a session token as the account, for administration too', async () => {
    const { token } = await signIn('ada@example.com');
    const res = await call('/api/tokens', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it('falls through to the guest header for a token that does not verify', async () => {
    const res = await call('/api/tokens', { headers: { Authorization: 'Bearer not-a-session' } });
    expect(res.status).not.toBe(200);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[auth] session_token_rejected'),
    );
  });

  it('refuses an account id presented as the guest header', async () => {
    const { id } = await signIn('ada@example.com');
    const res = await call('/api/documents', { headers: { 'X-Owner-Id': id } });
    expect(res.status).toBe(401);
  });

  it('deletes the data, then the identity, and signs the browser out', async () => {
    const { token, cookie, id } = await signIn('ada@example.com');
    const res = await call('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(sql.prepare('SELECT COUNT(*) AS n FROM identity_users WHERE id = ?').get(id)).toEqual({
      n: 0,
    });
    expect(sql.prepare('SELECT COUNT(*) AS n FROM identity_sessions').get()).toEqual({ n: 0 });
    const session = await call('/api/auth/get-session', { headers: { Cookie: cookie } });
    expect(await session.json()).toBeNull();
  });

  it('refuses to delete for a session older than ten minutes', async () => {
    const { token } = await signIn('ada@example.com');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    const res = await call('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: 'SESSION_NOT_FRESH' });
  });
});
