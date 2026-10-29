import { describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livedoc/document';
import { editorModeShortcut } from './editor-mode-shortcut';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): the next of Sketch, Structured and Pages,
// announced politely, wherever the switch is offered.
describe('editorModeShortcut', () => {
  const state = (mode: EditorMode, { canSwitch = true } = {}) => ({
    mode,
    canSwitch,
    canEdit: true,
    setMode: vi.fn(),
  });

  it('offers nothing where the switch is not offered (a Plan tab among them)', () => {
    expect(editorModeShortcut(state('diagram', { canSwitch: false }), vi.fn())).toBeNull();
    expect(editorModeShortcut(state('plan', { canSwitch: false }), vi.fn())).toBeNull();
  });

  it.each([
    ['draw', 'diagram', 'Structured mode'],
    ['diagram', 'pages', 'Pages mode'],
    ['pages', 'draw', 'Sketch mode'],
  ] as const)('from %s switches to %s and announces "%s"', (from, to, message) => {
    const s = state(from);
    const announce = vi.fn();
    editorModeShortcut(s, announce)!();
    expect(s.setMode).toHaveBeenCalledWith(to);
    expect(announce).toHaveBeenCalledWith(message);
  });
});
