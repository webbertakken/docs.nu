// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageEvent } from '@/lib/testing/storage-event';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md §2): one per-device store that
// Settings and the Collaborators modal both read.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

const { HIDE_CURSORS_KEY, useHideCursors } = await import('./useHideCursors');

afterEach(() => {
  track.mockReset();
  window.localStorage.clear();
  // Another tab's clear: the shared store forgets what it wrote, so each test starts from storage.
  act(() => {
    window.dispatchEvent(storageEvent({ key: null }));
  });
});

describe('useHideCursors', () => {
  it("is off until something turns it on, under LiveDoc's own key", () => {
    expect(HIDE_CURSORS_KEY).toBe('livedoc:v2:hide-cursors');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(false);
  });

  it("reads this device's stored choice", () => {
    window.localStorage.setItem(HIDE_CURSORS_KEY, 'true');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(true);
  });

  it('treats anything but true as off', () => {
    window.localStorage.setItem(HIDE_CURSORS_KEY, 'yes');
    expect(renderHook(() => useHideCursors()).result.current.hidden).toBe(false);
  });

  it('flips every reader at once, stores the choice, and reports it first', () => {
    const settings = renderHook(() => useHideCursors());
    const modal = renderHook(() => useHideCursors());
    // Telemetry goes before the write (docs/specs/017-telemetry/telemetry.md), so an opt-out still reaches the wire.
    track.mockImplementation(() =>
      expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBeNull(),
    );
    act(() => settings.result.current.setHidden(true));
    track.mockImplementation(() => undefined);
    expect(modal.result.current.hidden).toBe(true);
    expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBe('true');
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'HideCursorsOn');
    act(() => modal.result.current.setHidden(false));
    expect(settings.result.current.hidden).toBe(false);
    expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBe('false');
    expect(track).toHaveBeenLastCalledWith('UI', 'Toggled', 'HideCursorsOff');
  });

  it('follows a flip made in another tab', () => {
    const { result } = renderHook(() => useHideCursors());
    act(() => {
      window.localStorage.setItem(HIDE_CURSORS_KEY, 'true');
      window.dispatchEvent(storageEvent({ key: HIDE_CURSORS_KEY }));
    });
    expect(result.current.hidden).toBe(true);
  });
});
