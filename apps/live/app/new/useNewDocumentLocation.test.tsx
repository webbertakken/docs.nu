// @vitest-environment jsdom

// docs/specs/006-document/save-locations.md "The default depends on who is creating": /new stores a guest's
// document on This Browser, a signed-in person's on LiveDoc, and never makes a signed-in person's
// create This Browser because the session read had not answered yet.

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({ offered: true as boolean | null }));
vi.mock('@/lib/auth-config', () => ({ signInOfferedHere: () => host.offered }));

import { SIGNED_IN_HINT_KEY } from '@livediagram/account-session';
import { useNewDocumentLocation } from './useNewDocumentLocation';

function setHint(value: '0' | '1' | null) {
  if (value === null) localStorage.removeItem(SIGNED_IN_HINT_KEY);
  else localStorage.setItem(SIGNED_IN_HINT_KEY, value);
}

type Props = { authLoaded: boolean; accountId: string | null };
const render = (initial: Props) =>
  renderHook((p: Props) => useNewDocumentLocation(p), { initialProps: initial });

describe('useNewDocumentLocation', () => {
  afterEach(() => {
    setHint(null);
    host.offered = true;
  });

  describe('resolveSaveLocation', () => {
    it('keeps a signed-in person on LiveDoc', async () => {
      const { result } = render({ authLoaded: true, accountId: 'acct_1' });
      await expect(result.current.resolveSaveLocation(false, vi.fn())).resolves.toBe('livedoc');
    });

    it('answers a guest at once, without waiting for identity', async () => {
      const settle = vi.fn(() => new Promise<void>(() => {}));
      const { result } = render({ authLoaded: false, accountId: null });
      await expect(result.current.resolveSaveLocation(false, settle)).resolves.toBe('browser');
      expect(settle).not.toHaveBeenCalled();
    });

    it('waits for identity when the browser looks signed in, then reads the settled answer', async () => {
      setHint('1');
      const hook = render({ authLoaded: false, accountId: null });
      const settle = vi.fn(async () => {
        hook.rerender({ authLoaded: true, accountId: 'acct_1' });
      });
      await expect(hook.result.current.resolveSaveLocation(false, settle)).resolves.toBe('livedoc');
      expect(settle).toHaveBeenCalledOnce();
    });

    it('makes a guest This Browser when the hint was stale', async () => {
      setHint('1');
      const hook = render({ authLoaded: false, accountId: null });
      const settle = async () => hook.rerender({ authLoaded: true, accountId: null });
      await expect(hook.result.current.resolveSaveLocation(false, settle)).resolves.toBe('browser');
    });

    it('keeps a folder or team link on LiveDoc', async () => {
      const { result } = render({ authLoaded: false, accountId: null });
      await expect(result.current.resolveSaveLocation(true, vi.fn())).resolves.toBe('livedoc');
    });

    it('keeps everyone on LiveDoc without sign-in', async () => {
      host.offered = false;
      const { result } = render({ authLoaded: false, accountId: null });
      await expect(result.current.resolveSaveLocation(false, vi.fn())).resolves.toBe('livedoc');
    });

    it('asks the host once, in a browser that never has, before deciding', async () => {
      host.offered = null;
      const settle = vi.fn(async () => {
        host.offered = false;
      });
      const { result } = render({ authLoaded: false, accountId: null });
      await expect(result.current.resolveSaveLocation(false, settle)).resolves.toBe('livedoc');
      expect(settle).toHaveBeenCalledOnce();
    });
  });
});
