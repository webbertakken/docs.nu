import { describe, expect, it, vi } from 'vitest';
import { readSession, signOut } from './session';

const USER = {
  id: 'acct_abcdefghijklmnopqrstuvwx',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  image: 'https://lh3.googleusercontent.com/a/ada',
  createdAt: '2026-10-25T12:00:00.000Z',
  updatedAt: '2026-10-25T12:00:00.000Z',
};
const SESSION = {
  id: 's1',
  createdAt: '2026-10-25T12:30:00.000Z',
  expiresAt: '2026-11-24T12:30:00.000Z',
};

function answering(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('readSession', () => {
  it('reads a signed-in session from get-session', async () => {
    const fetchImpl = answering(200, { user: USER, session: SESSION });
    const state = await readSession({ apiBase: '/api', fetch: fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/auth/get-session', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(state).toEqual({
      status: 'signed-in',
      user: {
        id: USER.id,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: true,
        image: 'https://lh3.googleusercontent.com/a/ada',
        createdAt: new Date(USER.createdAt),
      },
      sessionCreatedAt: new Date(SESSION.createdAt),
    });
  });

  it('reads null as signed out', async () => {
    expect(await readSession({ apiBase: '/api', fetch: answering(200, null) })).toEqual({
      status: 'signed-out',
    });
  });

  it('reads 404 as sign-in being off on this host', async () => {
    expect(
      await readSession({ apiBase: '/api', fetch: answering(404, { error: 'not_found' }) }),
    ).toEqual({
      status: 'off',
    });
  });

  it('reads 401 as signed out', async () => {
    expect(await readSession({ apiBase: '/api', fetch: answering(401, {}) })).toEqual({
      status: 'signed-out',
    });
  });

  it('reads a server error or a network failure as unreachable', async () => {
    expect(await readSession({ apiBase: '/api', fetch: answering(503, {}) })).toEqual({
      status: 'unreachable',
    });
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await readSession({ apiBase: '/api', fetch: failing })).toEqual({
      status: 'unreachable',
    });
  });

  it('reads a body that is not a session as unreachable', async () => {
    const notJson = vi.fn(
      async () => new Response('<html>', { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await readSession({ apiBase: '/api', fetch: notJson })).toEqual({
      status: 'unreachable',
    });
    expect(
      await readSession({ apiBase: '/api', fetch: answering(200, { user: { id: 3 } }) }),
    ).toEqual({
      status: 'unreachable',
    });
  });

  it('fills what an older or thinner user record leaves out', async () => {
    const thin = { user: { id: USER.id, email: 'ada@example.com' }, session: {} };
    expect(await readSession({ apiBase: '', fetch: answering(200, thin) })).toEqual({
      status: 'signed-in',
      user: {
        id: USER.id,
        name: '',
        email: 'ada@example.com',
        emailVerified: false,
        image: null,
        createdAt: null,
      },
      sessionCreatedAt: null,
    });
  });

  it('reads an unreadable date as unknown', async () => {
    const odd = { user: { ...USER, createdAt: 'soon' }, session: { createdAt: 42 } };
    const state = await readSession({ apiBase: '/api', fetch: answering(200, odd) });
    expect(state).toMatchObject({ user: { createdAt: null }, sessionCreatedAt: null });
  });

  it('uses the global fetch when none is given', async () => {
    const fetchImpl = answering(200, null);
    vi.stubGlobal('fetch', fetchImpl);
    try {
      expect(await readSession({ apiBase: '/api' })).toEqual({ status: 'signed-out' });
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('signOut', () => {
  it('posts to sign-out and answers whether the session ended', async () => {
    const fetchImpl = answering(200, { success: true });
    expect(await signOut({ apiBase: '/api', fetch: fetchImpl })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  });

  it('answers false when the api refuses or cannot be reached', async () => {
    expect(await signOut({ apiBase: '/api', fetch: answering(500, {}) })).toBe(false);
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await signOut({ apiBase: '/api', fetch: failing })).toBe(false);
  });
});
