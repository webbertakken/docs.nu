// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIDNIGHT_PALETTE, useMidnightPalette } from './useMidnightPalette';

const sync = vi.hoisted(() => vi.fn());
vi.mock('@livedoc/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  syncChromeColour: sync,
}));

// docs/specs/004-interface-design/color-scheme.md "Explorer: Midnight": the root carries the palette while the
// Explorer is mounted, and loses it when the Explorer goes, so the editor keeps Steel.

afterEach(() => {
  delete document.documentElement.dataset.palette;
});

describe('useMidnightPalette', () => {
  it('marks the root while mounted and clears it on unmount', () => {
    const { unmount } = renderHook(() => useMidnightPalette());
    expect(document.documentElement.dataset.palette).toBe(MIDNIGHT_PALETTE);
    unmount();
    expect(document.documentElement.dataset.palette).toBeUndefined();
  });

  // docs/specs/004-interface-design/appearance.md "The browser's chrome": Midnight's navy reaches the title bar.
  it('repaints the browser chrome on arriving and on leaving', () => {
    const seen: (string | undefined)[] = [];
    sync.mockImplementation(() => seen.push(document.documentElement.dataset.palette));
    const { unmount } = renderHook(() => useMidnightPalette());
    unmount();
    expect(seen).toEqual([MIDNIGHT_PALETTE, undefined]);
  });

  it('leaves a palette someone else set after it alone', () => {
    const { unmount } = renderHook(() => useMidnightPalette());
    document.documentElement.dataset.palette = 'other';
    unmount();
    expect(document.documentElement.dataset.palette).toBe('other');
  });
});
