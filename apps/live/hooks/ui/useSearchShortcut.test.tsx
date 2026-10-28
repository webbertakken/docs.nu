// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSearchShortcut } from './useSearchShortcut';
import { writeLocalStorageValue } from './useLocalStorageValue';
import { modalClosed, modalOpened } from '@/lib/modal-guard';

const SHORTCUTS_KEY = 'livedoc:v2:shortcuts-enabled';

function press(
  key: string,
  init: KeyboardEventInit = { metaKey: true },
  target: EventTarget = window,
) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

afterEach(() => {
  writeLocalStorageValue(SHORTCUTS_KEY, 'true');
  document.body.innerHTML = '';
});

// The Search panel shortcut off the editor (docs/specs/007-editor/command-palette.md "Shortcut").
describe('useSearchShortcut', () => {
  it('opens search on Cmd+K, Ctrl+K and Cmd+.', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    expect(press('k').defaultPrevented).toBe(true);
    press('K', { ctrlKey: true });
    press('.', { metaKey: true });
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('ignores the plain key and other chords', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    press('k', {});
    press('j', { metaKey: true });
    press('k', { metaKey: true, altKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves text fields alone', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(press('k', { metaKey: true }, input).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves text areas, selects and editable text alone', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    const targets = [
      document.createElement('textarea'),
      document.createElement('select'),
      editable,
    ];
    for (const target of targets) {
      document.body.appendChild(target);
      expect(press('.', { ctrlKey: true }, target).defaultPrevented).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('stands down while any aria-modal dialog is in the page', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const drawer = document.createElement('div');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    document.body.appendChild(drawer);
    expect(press('k').defaultPrevented).toBe(false);
    expect(press('.', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('stands aside for a key another handler already took', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    const taker = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', taker, { capture: true });
    try {
      press('k');
    } finally {
      window.removeEventListener('keydown', taker, { capture: true });
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('stands down while a dialog is open', () => {
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    modalOpened();
    try {
      press('k');
    } finally {
      modalClosed();
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('respects the Keyboard Shortcuts setting', () => {
    writeLocalStorageValue(SHORTCUTS_KEY, 'false');
    const open = vi.fn();
    renderHook(() => useSearchShortcut(open));
    press('k');
    expect(open).not.toHaveBeenCalled();
  });
});
