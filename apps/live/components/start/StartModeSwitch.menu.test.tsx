// @vitest-environment jsdom

// The mode switch on a start's rail (docs/specs/007-editor/editor-modes.md "The mode switch"): a named dropdown chip
// opening the plain mode menu (Sketch, Structured, Pages), the same for everyone, reading the editor's
// resolved mode from EditorModeProvider; nothing where no switch is offered.

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ES_BOARD_LAYER_ID,
  SWITCHABLE_EDITOR_MODES,
  editorModeLabel,
  type EditorMode,
  type Tab,
} from '@livedoc/document';
import { useEditorMode, type EditorModeState } from '@/hooks/editor/useEditorMode';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { StartModeSwitch } from './StartModeSwitch';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/view-transition', () => ({
  startTypedTransition: (_type: string, change: () => void) => change(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSwitch(mode: EditorMode, over: Partial<EditorModeState> = {}) {
  const onChange = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeProvider
      value={{
        mode,
        setMode: onChange,
        canSwitch: true,
        canEdit: true,
        workshop: false,
        setWorkshop: vi.fn(),
        ...over,
      }}
    >
      <StartModeSwitch />
    </EditorModeProvider>,
  );
  return { onChange, ...view };
}

const slot = (container: HTMLElement) => container.querySelector('[data-start-mode-switch]');
const chip = () => screen.getByRole('button', { name: /^Tab mode:/ });

describe('StartModeSwitch chip', () => {
  it.each(SWITCHABLE_EDITOR_MODES)('is a collapsed menu button named after %s', (mode) => {
    renderSwitch(mode);
    expect(chip().getAttribute('aria-label')).toBe(`Tab mode: ${editorModeLabel(mode)}`);
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the current mode as its icon and name', () => {
    renderSwitch('diagram');
    expect(chip().textContent).toBe('Structured');
    expect(chip().querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('opens a menu of the three modes, in order, focusing the checked one', () => {
    renderSwitch('draw');
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('menu', { name: 'Editor mode' });
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((row) => row.textContent)).toEqual(['Sketch', 'Structured', 'Pages']);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(document.activeElement).toBe(rows[0]);
  });

  it('names each row by its mode alone, with no description', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((row) => row.getAttribute('data-mode-row'))).toEqual([
      ...SWITCHABLE_EDITOR_MODES,
    ]);
    for (const [i, row] of rows.entries()) {
      expect(row.textContent).toBe(editorModeLabel(SWITCHABLE_EDITOR_MODES[i]!));
      expect(row.hasAttribute('aria-describedby')).toBe(false);
    }
  });

  it.each(['ArrowDown', 'ArrowUp'])('opens from the keyboard with %s', (key) => {
    renderSwitch('diagram');
    fireEvent.keyDown(chip(), { key });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('moves focus with ArrowDown, ArrowUp, Home and End, wrapping around', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const menu = screen.getByRole('menu');
    const [sketch, structured, pages] = screen.getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(structured);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(pages);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(sketch);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(pages);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(sketch);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(pages);
  });

  it.each([
    ['diagram', 'Sketch', 'draw'],
    ['draw', 'Structured', 'diagram'],
  ] as const)('from %s, choosing %s switches, closes and refocuses the chip', (from, row, to) => {
    const { onChange } = renderSwitch(from);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: row }));
    expect(onChange).toHaveBeenCalledWith(to);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  it('closes without choosing on the current row', () => {
    const { onChange } = renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Structured' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the chip', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    // Escape from inside the menu, where opening put the focus.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  // Safari does not focus a pressed button: pressing a row blurs the focused row to nowhere first.
  it('keeps the menu open through a blur to nowhere, so the pressed row still switches', () => {
    const { onChange } = renderSwitch('draw');
    fireEvent.click(chip());
    const [sketch, structured] = screen.getAllByRole('menuitemradio');
    fireEvent.focusOut(sketch!, { relatedTarget: null });
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.click(structured!);
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('closes when focus moves outside (Tab away)', () => {
    renderSwitch('diagram');
    const outside = document.createElement('button');
    document.body.append(outside);
    fireEvent.click(chip());
    fireEvent.focusOut(screen.getAllByRole('menuitemradio')[0]!, { relatedTarget: outside });
    expect(screen.queryByRole('menu')).toBeNull();
    outside.remove();
  });

  it('closes on a press outside', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens downward, from the left edge', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    expect(screen.getByRole('menu').className).toMatch(/left-0/);
    expect(screen.getByRole('menu').className).toMatch(/top-full/);
  });
});

describe('StartModeSwitch slot', () => {
  it('keeps one width across both modes (zero layout shift)', () => {
    const widths = new Set<string>();
    for (const mode of SWITCHABLE_EDITOR_MODES) {
      widths.add(slot(renderSwitch(mode).container)!.className);
      cleanup();
    }
    expect(widths.size).toBe(1);
  });

  it('renders nothing outside an editor', () => {
    const { container } = render(<StartModeSwitch />);
    expect(container.innerHTML).toBe('');
  });
});

// The switch reads the editor's own resolution (useEditorMode), as EditorView provides it.
describe('StartModeSwitch in the editor', () => {
  let seq = 0;
  const freshTab = (over: Partial<Tab> = {}): Tab => {
    seq += 1;
    return { id: `sw${seq}`, name: 'Tab', elements: [], ...over };
  };
  // The tab held as the editor holds it: a switch commits onto it and re-renders.
  function Host({ tab: initial, canEdit = true }: { tab: Tab; canEdit?: boolean }) {
    const [tabs, setTabs] = useState([initial]);
    const editorMode = useEditorMode(tabs[0], {
      canEdit,
      commitTabs: (map) => setTabs((ts) => map(ts)),
      toastInfo: () => {},
    });
    return (
      <EditorModeProvider value={editorMode}>
        <StartModeSwitch />
      </EditorModeProvider>
    );
  }

  it("shows the tab's mode, and switches the tab from the menu", () => {
    render(<Host tab={freshTab({ opensIn: 'draw' })} />);
    expect(chip().getAttribute('aria-label')).toBe('Tab mode: Sketch');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Structured' }));
    expect(chip().getAttribute('aria-label')).toBe('Tab mode: Structured');
  });

  // docs/specs/007-editor/live-app.md#role-pill: previewing as a viewer, an editor is a viewer.
  it('offers a visitor who cannot edit no switch', () => {
    const { container } = render(<Host tab={freshTab()} canEdit={false} />);
    expect(slot(container)).toBeNull();
  });

  it('offers no switch on an event-storming board, nor a legacy one known by its layer', () => {
    const { container } = render(<Host tab={freshTab({ kind: 'event-storming' })} />);
    expect(slot(container)).toBeNull();
    cleanup();
    const layers = [{ id: ES_BOARD_LAYER_ID, name: 'Board', visible: true }];
    const legacy = render(<Host tab={freshTab({ layers })} />);
    expect(slot(legacy.container)).toBeNull();
  });
});

// docs/specs/026-plan/plan-tabs.md "The kinds": a Plan tab is never switched, so it shows no switch.
describe('StartModeSwitch on a Plan tab', () => {
  it('renders nothing where the switch is not offered', () => {
    const { container } = renderSwitch('plan', { canSwitch: false });
    expect(slot(container)).toBeNull();
  });
});
