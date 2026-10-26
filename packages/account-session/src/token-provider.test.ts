import { describe, expect, it, vi } from 'vitest';
import { createTokenProvider, expiryOf, SESSION_TOKEN_REFRESH_MARGIN_S } from './token-provider';

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(exp: number | undefined): string {
  return `${base64url({ alg: 'EdDSA' })}.${base64url({ sub: 'acct_x', exp })}.sig`;
}

const NOW_S = 1_800_000_000;

function setup(answers: Array<{ status: number; body?: unknown } | Error>) {
  const queue = [...answers];
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('no more answers');
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  let nowMs = NOW_S * 1000;
  const onSignedOut = vi.fn();
  const provider = createTokenProvider({
    apiBase: '/api',
    fetch: fetchImpl,
    now: () => nowMs,
    onSignedOut,
  });
  return {
    provider,
    fetchImpl,
    onSignedOut,
    advance: (seconds: number) => {
      nowMs += seconds * 1000;
    },
  };
}

describe('createTokenProvider', () => {
  it('fetches a session token and keeps it until a minute before it expires', async () => {
    const first = jwt(NOW_S + 900);
    const second = jwt(NOW_S + 1800);
    const { provider, fetchImpl, advance } = setup([
      { status: 200, body: { token: first } },
      { status: 200, body: { token: second } },
    ]);
    expect(await provider.getToken()).toBe(first);
    expect(fetchImpl).toHaveBeenCalledWith('/api/auth/token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    advance(900 - SESSION_TOKEN_REFRESH_MARGIN_S - 1);
    expect(await provider.getToken()).toBe(first);
    expect(fetchImpl).toHaveBeenCalledOnce();
    advance(1);
    expect(await provider.getToken()).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fetches again when asked to skip the cache', async () => {
    const first = jwt(NOW_S + 900);
    const second = jwt(NOW_S + 900);
    const { provider, fetchImpl } = setup([
      { status: 200, body: { token: first } },
      { status: 200, body: { token: second } },
    ]);
    await provider.getToken();
    expect(await provider.getToken({ skipCache: true })).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch between callers asking at once', async () => {
    const token = jwt(NOW_S + 900);
    const { provider, fetchImpl } = setup([{ status: 200, body: { token } }]);
    const answers = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);
    expect(answers).toEqual([token, token, token]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reads 401 as signed out: clears, tells the bridge, answers null', async () => {
    const token = jwt(NOW_S + 900);
    const { provider, onSignedOut } = setup([{ status: 200, body: { token } }, { status: 401 }]);
    await provider.getToken();
    expect(await provider.getToken({ skipCache: true })).toBeNull();
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(provider.getLastKnownToken()).toBeNull();
  });

  it('answers null without signing out when the api fails or is unreachable', async () => {
    const { provider, onSignedOut } = setup([
      { status: 500 },
      new TypeError('offline'),
      { status: 200, body: {} },
    ]);
    expect(await provider.getToken()).toBeNull();
    expect(await provider.getToken()).toBeNull();
    expect(await provider.getToken()).toBeNull();
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('answers null for a body that is not json', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<html>', { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = createTokenProvider({ apiBase: '/api', fetch: fetchImpl });
    expect(await provider.getToken()).toBeNull();
  });

  it('never caches a token whose expiry it cannot read', async () => {
    const opaque = 'not-a-jwt';
    const { provider, fetchImpl } = setup([
      { status: 200, body: { token: opaque } },
      { status: 200, body: { token: opaque } },
    ]);
    expect(await provider.getToken()).toBe(opaque);
    expect(await provider.getToken()).toBe(opaque);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the last token for the unload beacon until cleared', async () => {
    const token = jwt(NOW_S + 900);
    const { provider } = setup([{ status: 200, body: { token } }]);
    expect(provider.getLastKnownToken()).toBeNull();
    await provider.getToken();
    expect(provider.getLastKnownToken()).toBe(token);
    provider.clear();
    expect(provider.getLastKnownToken()).toBeNull();
  });

  it('drops a fetch that was in flight when it was cleared', async () => {
    const token = jwt(NOW_S + 900);
    const { provider } = setup([{ status: 200, body: { token } }]);
    const pending = provider.getToken();
    provider.clear();
    expect(await pending).toBe(token);
    expect(provider.getLastKnownToken()).toBeNull();
  });

  it('uses the clock and fetch of the page by default', async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 900);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ token }), { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const provider = createTokenProvider({ apiBase: '' });
      expect(await provider.getToken()).toBe(token);
      expect(await provider.getToken()).toBe(token);
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(fetchImpl).toHaveBeenCalledWith('/auth/token', expect.anything());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('expiryOf', () => {
  it('reads exp from the payload, in seconds', () => {
    expect(expiryOf(jwt(NOW_S))).toBe(NOW_S);
  });

  it('reads nothing from a token without a readable exp', () => {
    expect(expiryOf('a.b')).toBeNull();
    expect(expiryOf(jwt(undefined))).toBeNull();
    expect(expiryOf(`x.${btoa('{')}.y`)).toBeNull();
    expect(expiryOf(`x.${base64url({ exp: 'soon' })}.y`)).toBeNull();
  });
});
