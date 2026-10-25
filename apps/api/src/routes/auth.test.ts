import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { handleAuth } from './auth';

const ORIGIN = 'https://docs.test';
const SIGN_IN = { BETTER_AUTH_SECRET: 's'.repeat(40), APP_BASE_URL: ORIGIN, EMAIL_OUTBOX: '1' };

const limiter = (success: boolean) => ({
  limit: vi.fn(async (_input: { key: string }) => ({ success })),
});

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.9',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

let env: Env;

beforeEach(() => {
  env = sqliteD1(SIGN_IN).env;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function signedInCookie(): Promise<string> {
  await handleAuth(
    post('/api/auth/email-otp/send-verification-otp', { email: 'a@b.co', type: 'sign-in' }),
    env,
  );
  const row = (await env.DB.prepare(
    'SELECT subject FROM email_outbox ORDER BY id DESC',
  ).first()) as {
    subject: string;
  };
  const res = await handleAuth(
    post('/api/auth/sign-in/email-otp', { email: 'a@b.co', otp: row.subject.slice(0, 6) }),
    env,
  );
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

describe('handleAuth', () => {
  it('is absent on a guest-only host', async () => {
    expect((await handleAuth(post('/api/auth/sign-out', {}), sqliteD1({}).env)).status).toBe(404);
  });

  it('limits every POST per network', async () => {
    env = { ...env, AUTH_RATE_LIMITER: limiter(false) };
    const res = await handleAuth(post('/api/auth/sign-out', {}), env);
    expect(res.status).toBe(429);
    expect(env.AUTH_RATE_LIMITER!.limit).toHaveBeenCalledWith({ key: 'auth:203.0.113.9' });
    expect(console.warn).toHaveBeenCalledWith(
      '[auth] rate_limited route=/api/auth/sign-out limiter=ip',
    );
  });

  it('limits code sends per address, keyed on its hash', async () => {
    env = { ...env, AUTH_RATE_LIMITER: limiter(true), AUTH_EMAIL_RATE_LIMITER: limiter(false) };
    const res = await handleAuth(
      post('/api/auth/email-otp/send-verification-otp', {
        email: ' Ada@Example.com ',
        type: 'sign-in',
      }),
      env,
    );
    expect(res.status).toBe(429);
    const key = vi.mocked(env.AUTH_EMAIL_RATE_LIMITER!.limit).mock.calls[0]![0].key;
    expect(key).toMatch(/^auth-email:[0-9a-f]{64}$/);
    expect(key).not.toContain('ada');
  });

  it('lets a code send through when its address is under the limit, or unreadable', async () => {
    env = { ...env, AUTH_EMAIL_RATE_LIMITER: limiter(true) };
    const ok = await handleAuth(
      post('/api/auth/email-otp/send-verification-otp', { email: 'a@b.co', type: 'sign-in' }),
      env,
    );
    expect(ok.status).toBe(200);
    const garbage = await handleAuth(
      post('/api/auth/email-otp/send-verification-otp', 'not json'),
      env,
    );
    expect(garbage.status).toBe(400);
    expect(env.AUTH_EMAIL_RATE_LIMITER!.limit).toHaveBeenCalledTimes(1);
  });

  it('asks for a fresh sign-in before removing a sign-in method', async () => {
    const cookie = await signedInCookie();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    const res = await handleAuth(
      post('/api/auth/unlink-account', { providerId: 'google' }, { Cookie: cookie }),
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'SESSION_NOT_FRESH' });
  });

  it('passes a fresh session through to better-auth', async () => {
    const cookie = await signedInCookie();
    const res = await handleAuth(
      post('/api/auth/unlink-account', { providerId: 'google' }, { Cookie: cookie }),
      env,
    );
    expect(res.status).not.toBe(403);
  });
});
