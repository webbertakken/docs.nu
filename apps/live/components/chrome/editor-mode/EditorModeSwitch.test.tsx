// @vitest-environment jsdom

// The mode switch beside the menu button (docs/specs/007-editor/editor-modes.md "The mode switch"): a compact chip,
// named for the editor, on every tab an Editor may switch, empty or not; its menu floats in a portal; it and the
// start's switch read and write the one mode, so they always agree.

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livedoc/document';
import type { EditorModeState } from '@/hooks/editor/useEditorMode';
import { StartModeSwitch } from '@/components/start/StartModeSwitch';
import { EditorModeProvider } from './editor-mode-context';
import { EditorModeSwitch } from './EditorModeSwitch';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/view-transition', () => ({
  startTypedTransition: (_type: string, change: () => void) => change(),
}));
const confirm = vi.hoisted(() => vi.fn(async () => false));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSwitch(
  mode: EditorMode,
  over: Partial<EditorModeState> = {},
  props: { iconOnly?: boolean } = {},
) {
  const setMode = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeProvider value={{ mode, setMode, canSwitch: true, canEdit: true, ...over }}>
      <EditorModeSwitch {...props} />
    </EditorModeProvider>,
  );
  return { setMode, ...view };
}

const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

describe('EditorModeSwitch', () => {
  it('is a compact menu button named for the editor, showing the mode by icon and name', () => {
    renderSwitch('draw');
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    expect(chip().textContent).toBe('Draw');
    expect(chip().className).toContain('h-9');
  });

  it('shows its icon alone on a phone, keeping its accessible name', () => {
    renderSwitch('workshop', {}, { iconOnly: true });
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Workshop');
    expect(chip().textContent).toBe('');
    expect(chip().querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it.each([
    ['a Participant or a Viewer', { canEdit: false, canSwitch: false }],
    ['a locked tab or an event-storming board', { canEdit: true, canSwitch: false }],
  ])('renders nothing for %s', (_, gate) => {
    const { container } = renderSwitch('diagram', gate);
    expect(container.querySelector('[data-editor-mode-switch]')).toBeNull();
  });

  it('renders nothing outside an editor', () => {
    const { container } = render(<EditorModeSwitch />);
    expect(container.innerHTML).toBe('');
  });

  it('shows on a Board, Sheet or Dashboard tab, where another mode is a new tab', () => {
    renderSwitch('plan', { canSwitch: false, lockedReason: 'Board is always in Plan.' });
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Plan');
  });

  it('floats its menu in a portal, outside the menu card, and a press on it keeps it open', () => {
    const { container } = renderSwitch('diagram');
    fireEvent.click(chip());
    const menu = screen.getByRole('menu');
    expect(menu.hasAttribute('data-mode-menu')).toBe(true);
    expect(container.contains(menu)).toBe(false);
    expect(menu.className).toContain('fixed');
    fireEvent.pointerDown(menu);
    fireEvent.mouseDown(menu);
    expect(screen.queryByRole('menu')).not.toBeNull();
  });

  it('switches a tab with content between modes on its side of Plan', () => {
    const { setMode } = renderSwitch('diagram', { crossPlan: false });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Draw/ }));
    expect(setMode).toHaveBeenCalledWith('draw');
  });

  it('never switches a tab with content into Plan: that row offers a new tab', () => {
    const newTabIn = vi.fn();
    const { setMode } = renderSwitch('diagram', { crossPlan: false, newTabIn });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Plan/ }));
    expect(setMode).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
  });
});

describe('EditorModeSwitch beside the start switch', () => {
  // One mode, read and written by both, as the editor's EditorModeProvider gives it.
  function Both() {
    const [mode, setMode] = useState<EditorMode>('diagram');
    return (
      <EditorModeProvider
        value={{ mode, setMode, canSwitch: true, canEdit: true, crossPlan: true }}
      >
        <EditorModeSwitch />
        <StartModeSwitch />
      </EditorModeProvider>
    );
  }

  it('always agrees: a switch in either place shows in both', () => {
    render(<Both />);
    const start = () => screen.getByRole('button', { name: /^Tab mode:/ });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Workshop/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Workshop');
    expect(start().getAttribute('aria-label')).toBe('Tab mode: Workshop');
    fireEvent.click(start());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Pages/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Pages');
    expect(start().getAttribute('aria-label')).toBe('Tab mode: Pages');
  });
});
