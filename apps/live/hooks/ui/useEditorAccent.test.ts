// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorAccent } from './useEditorAccent';

const sync = vi.hoisted(() => vi.fn());
vi.mock('@livedoc/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  syncChromeColour: sync,
}));

const accentStyle = () => document.getElementById('lvd-editor-accent');

afterEach(() => {
  accentStyle()?.remove();
  sync.mockReset();
});

// docs/specs/004-interface-design/appearance.md "The browser's chrome": a themed tab's dark surface is the header's,
// so the title bar follows the tint in and out.
describe('useEditorAccent', () => {
  it('repaints the browser chrome once the tint is in, and again once it is gone', () => {
    const seen: boolean[] = [];
    sync.mockImplementation(() => seen.push(accentStyle() !== null));
    const themed: { id: string | undefined } = { id: 'forest' };
    const { rerender, unmount } = renderHook(({ id }) => useEditorAccent(id), {
      initialProps: themed,
    });
    rerender({ id: undefined });
    renderHook(() => useEditorAccent('forest')).unmount();
    unmount();
    expect(seen).toEqual([true, false, false, true, false]);
  });
});
