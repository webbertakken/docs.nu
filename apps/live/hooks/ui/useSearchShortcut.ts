'use client';

import { useEffect } from 'react';
import { anyModalOpen } from '@/lib/modal-guard';
import { useLatest } from './useLatest';
import { useShortcutsEnabled } from './useShortcutsEnabled';
import { isTypingTarget } from '@/lib/typing-target';

// The Search panel's shortcut, Cmd/Ctrl+K or Cmd/Ctrl+. (docs/specs/007-editor/command-palette.md
// "Shortcut"), for surfaces outside the editor. The editor binds the same chords inside its own
// shortcut table (hooks/canvas/editor-shortcut-keys.ts); this hook is the Explorer page's.
// Like the editor it stands down when the Keyboard Shortcuts setting is off, while typing in a
// text field (the editor's chords skip text fields too), while a dialog is open, and for a key another handler
// already took. A dialog is one counted by the modal guard or any `aria-modal` element in the page, so an ad-hoc
// modal that forgot the guard still keeps the chord inside it.

/** Whether a modal dialog is open: one the modal guard counts, or any `aria-modal` element. */
function dialogOpen(): boolean {
  return anyModalOpen() || document.querySelector('[aria-modal="true"]') !== null;
}

function isSearchChord(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === '.' || e.key.toLowerCase() === 'k';
}

export function useSearchShortcut(onOpenSearch: () => void): void {
  const { enabled } = useShortcutsEnabled();
  const open = useLatest(onOpenSearch);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isSearchChord(e)) return;
      if (isTypingTarget(e.target) || dialogOpen()) return;
      e.preventDefault();
      open.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, open]);
}
