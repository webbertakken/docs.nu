import { describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livedoc/document';
import { editorModeShortcut } from './editor-mode-shortcut';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): next mode, announced politely,
// wherever the switch is offered: every mode on an empty tab (crossPlan), the modes beside Plan's line on one with content.
describe('editorModeShortcut', () => {
  const state = (mode: EditorMode, { canSwitch = true, crossPlan = true } = {}) => ({
    mode,
    canSwitch,
    crossPlan,
    canEdit: true,
    setMode: vi.fn(),
  });

  it('offers nothing where the switch is not offered', () => {
    expect(editorModeShortcut(state('diagram', { canSwitch: false }), vi.fn())).toBeNull();
  });

  it.each([
    ['diagram', 'draw'],
    ['draw', 'workshop'],
    ['workshop', 'pages'],
    ['pages', 'diagram'],
  ] as const)('on a tab with content, from %s steps to %s, never across into Plan', (from, to) => {
    const s = state(from, { crossPlan: false });
    editorModeShortcut(s, vi.fn())!();
    expect(s.setMode).toHaveBeenCalledWith(to);
  });

  it('offers nothing on a Plan tab with content: no mode sits beside it', () => {
    expect(editorModeShortcut(state('plan', { crossPlan: false }), vi.fn())).toBeNull();
  });

  it.each([
    ['diagram', 'draw', 'Draw mode'],
    ['draw', 'workshop', 'Workshop mode'],
    ['workshop', 'pages', 'Pages mode'],
    ['pages', 'plan', 'Plan mode'],
    ['plan', 'diagram', 'Diagram mode'],
  ] as const)('on an empty tab, from %s switches to %s and announces "%s"', (from, to, message) => {
    const s = state(from);
    const announce = vi.fn();
    editorModeShortcut(s, announce)!();
    expect(s.setMode).toHaveBeenCalledWith(to);
    expect(announce).toHaveBeenCalledWith(message);
  });
});
