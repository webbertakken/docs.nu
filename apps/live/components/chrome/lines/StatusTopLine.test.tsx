// @vitest-environment jsdom

// A screen with no document yet keeps the top line's Back and the account control, and nothing a document offers.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-config', () => ({ useSignInAvailable: () => true }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({ authLoaded: true, isSignedIn: false, user: null, signOut: vi.fn() }),
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));

const { StatusTopLine } = await import('./StatusTopLine');

afterEach(cleanup);

describe('StatusTopLine', () => {
  it('offers Back to the Explorer and Sign in, and no document action', () => {
    render(<StatusTopLine />);
    expect(screen.getByRole('link', { name: 'Back to the Explorer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Explorer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});
