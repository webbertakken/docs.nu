// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGN_IN_OFFERED_KEY } from '@livedoc/account-session';

// The two pieces around the app: CommunityGate (docs/specs/025-community/community.md "Turning the Community
// off") and the session My Shares reads ("My Shares").

const h = vi.hoisted(() => ({
  enabled: true,
  replace: vi.fn(),
}));

vi.mock('@livedoc/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livedoc/ui')>()),
  useCommunityEnabled: () => h.enabled,
}));

import { loadCommunitySession, mineMayBeOffered } from '@/lib/session';
import { CommunityGate } from './CommunityGate';

beforeEach(() => {
  h.enabled = true;
  localStorage.clear();
  h.replace.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace: h.replace },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CommunityGate', () => {
  it('shows the app while the Community is on', () => {
    render(<CommunityGate>The gallery</CommunityGate>);
    expect(screen.getByText('The gallery')).toBeTruthy();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('shows nothing and goes home while it is switched off', () => {
    h.enabled = false;
    render(<CommunityGate>The gallery</CommunityGate>);
    expect(screen.queryByText('The gallery')).toBeNull();
    expect(h.replace).toHaveBeenCalledWith('/');
  });
});

function answering(answers: Record<string, { status: number; body: unknown }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const answer = answers[url];
    if (!answer) throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const USER = { id: 'acct_abcdefghijklmnopqrstuvwx', email: 'ada@example.com', name: 'Ada' };

describe('the My Shares session', () => {
  it('reads a signed-in session and hands out its token', async () => {
    answering({
      '/api/auth/get-session': { status: 200, body: { user: USER, session: {} } },
      '/api/auth/token': { status: 200, body: { token: 'token-1' } },
    });
    const session = await loadCommunitySession();
    expect(session).toMatchObject({
      loaded: true,
      signedIn: true,
      signInAvailable: true,
      accountId: USER.id,
    });
    expect(await session!.getToken()).toBe('token-1');
    expect(localStorage.getItem(SIGN_IN_OFFERED_KEY)).toBe('1');
  });

  it('reads a signed-out visitor, who has no token', async () => {
    answering({ '/api/auth/get-session': { status: 200, body: null } });
    const session = await loadCommunitySession();
    expect(session).toMatchObject({ loaded: true, signedIn: false, accountId: null });
    expect(await session!.getToken()).toBeNull();
  });

  it('learns a host has no sign-in, and stops offering My Shares', async () => {
    expect(mineMayBeOffered()).toBe(true);
    answering({ '/api/auth/get-session': { status: 404, body: {} } });
    expect(await loadCommunitySession()).toMatchObject({ signInAvailable: false, signedIn: false });
    expect(mineMayBeOffered()).toBe(false);
  });

  it('answers nothing when the api cannot be asked, and says so', async () => {
    answering({});
    expect(await loadCommunitySession()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[community] session_read_failed');
  });
});
