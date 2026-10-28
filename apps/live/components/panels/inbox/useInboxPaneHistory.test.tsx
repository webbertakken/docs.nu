// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INBOX_PANE_STATE, useInboxPaneHistory } from './useInboxPaneHistory';

// The narrow pane's history entry (docs/specs/013-workspace/inbox.md §1.7): one entry per opening, the page's state
// kept; Back closes the pane; leaving the pane, or its row vanishing, steps back off the entry; and an opening while
// the entry is still on top takes it over instead of stacking another.

const flagged = () => (window.history.state as Record<string, unknown> | null)?.[INBOX_PANE_STATE];

beforeEach(() => {
  window.history.replaceState({ router: 'kept' }, '');
});

function setUp(standing = false) {
  const onPopped = vi.fn();
  const hook = renderHook(({ s }) => useInboxPaneHistory(s, onPopped), {
    initialProps: { s: standing },
  });
  return { ...hook, onPopped };
}

describe('useInboxPaneHistory', () => {
  it('adds one entry when the pane stands, keeping the page’s state', () => {
    window.history.pushState({ router: 'kept' }, '');
    const before = window.history.length;
    const { rerender } = setUp();
    rerender({ s: true });
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toEqual({ router: 'kept', [INBOX_PANE_STATE]: true });
  });

  it('closes the pane when Back is pressed', async () => {
    const { rerender, onPopped } = setUp();
    rerender({ s: true });
    act(() => window.history.back());
    await waitFor(() => expect(onPopped).toHaveBeenCalledTimes(1));
    expect(flagged()).toBeUndefined();
  });

  it('steps back off its entry when the pane closes or its row vanishes', async () => {
    const { rerender, onPopped } = setUp();
    rerender({ s: true });
    rerender({ s: false });
    await waitFor(() => expect(flagged()).toBeUndefined());
    expect(window.history.state).toEqual({ router: 'kept' });
    // Its own step back is not a Back the reader pressed.
    expect(onPopped).not.toHaveBeenCalled();
  });

  it('takes over its entry when opened again before the step back lands', async () => {
    const { rerender, onPopped } = setUp();
    rerender({ s: true });
    const opened = window.history.length;
    rerender({ s: false });
    // Still on top: the step back is on its way.
    expect(flagged()).toBe(true);
    rerender({ s: true });
    expect(window.history.length).toBe(opened);
    // The step back lands; the pane still stands, so it has its entry again, and only one.
    await waitFor(() => expect(flagged()).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(flagged()).toBe(true);
    expect(onPopped).not.toHaveBeenCalled();
  });
});
