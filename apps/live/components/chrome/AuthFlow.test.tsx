// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/014-identity/auth-and-guest-access.md "Auth surface": signing in leaves the page in place of itself, so
// Back from where it lands never comes back to a sign-in page that would only send the person on again.

const { authClient } = vi.hoisted(() => ({
  authClient: {
    emailOtp: { sendVerificationOtp: vi.fn() },
    signIn: { emailOtp: vi.fn(), social: vi.fn() },
    updateUser: vi.fn(),
  },
}));
vi.mock('@/lib/auth-client', () => ({ authClient }));
vi.mock('@/lib/auth-config', () => ({
  useAuthConfig: () => ({
    signIn: 'on',
    methods: ['email-code'],
    googleClientId: null,
    emailOutbox: false,
  }),
}));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({ authLoaded: true, isSignedIn: false }),
}));
vi.mock('@/hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('redirect_url=/explorer'),
}));
vi.mock('@livedoc/account-session', () => ({
  announceAccountChange: vi.fn(),
  writeSignedInHint: vi.fn(),
}));

const { AuthFlow } = await import('./AuthFlow');

let replace: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replace = vi.fn();
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, replace, assign });
  authClient.emailOtp.sendVerificationOtp.mockResolvedValue({ error: null });
  authClient.signIn.emailOtp.mockResolvedValue({
    data: { user: { name: 'Ada' } },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AuthFlow', () => {
  it('leaves a signed-in page in place of itself, never pushing it onto history', async () => {
    render(<AuthFlow kind="sign-in" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    });
    expect(replace).toHaveBeenCalledWith('/explorer');
    expect(assign).not.toHaveBeenCalled();
  });
});
