// @vitest-environment jsdom
// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md): it toggles the Explorer and
// hands itself over as the popover's anchor.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from './editor-mode/editor-mode-context';
import { ToolbarExplorerButton } from './ToolbarExplorerButton';

afterEach(() => {
  cleanup();
});

describe('ToolbarExplorerButton', () => {
  it('passes its own element to the toggle, to anchor the popover under it', () => {
    const onToggle = vi.fn();
    render(<ToolbarExplorerButton open={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Explorer' });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(button);
  });

  it('reports whether the Explorer is open', () => {
    const { rerender } = render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    rerender(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('keeps its focus as the Explorer opens, so a keyboard opener is not dropped to the page', () => {
    // It used to lose its hover card on open, which re-parented the button and remounted it.
    const { rerender } = render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Explorer' });
    button.focus();
    rerender(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it("sits inside the dock's outside-click exemption", () => {
    // Otherwise pressing it while the Explorer is open would close the panel
    // on pointer-down and reopen it on click.
    render(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).closest('[data-dock-button]')).not.toBe(
      null,
    );
  });

  // The canvas's capture-phase gestures skip floating chrome: without the marker a press on the
  // card with a Draw pen in hand started a stroke instead.
  it('marks its card as floating chrome, so a Draw tool in hand never takes the press', () => {
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Explorer' }).closest('[data-floating-panel]'),
    ).not.toBeNull();
  });

  // docs/specs/007-editor/editor-modes.md "The mode switch": beside the menu button, named on a computer, its icon
  // alone on a phone or in the strip's row.
  it.each([
    [false, 'Draw'],
    [true, null],
  ] as const)(
    'carries the editor mode switch right after the menu button (inline %s)',
    (inline, name) => {
      const { container } = render(
        <EditorModeProvider
          value={{ mode: 'draw', setMode: vi.fn(), canSwitch: true, canEdit: true }}
        >
          <ToolbarExplorerButton open={false} onToggle={vi.fn()} inline={inline} />
        </EditorModeProvider>,
      );
      const chip = screen.getByRole('button', { name: 'Editor mode: Draw' });
      expect(chip.getAttribute('aria-haspopup')).toBe('menu');
      expect(chip.textContent?.includes('Draw') ? 'Draw' : null).toBe(name);
      const buttons: HTMLElement[] = Array.from(container.querySelectorAll('button'));
      expect(buttons.indexOf(chip)).toBe(
        buttons.indexOf(screen.getByRole('button', { name: 'Explorer' })) + 1,
      );
    },
  );

  it.each([
    ['a Participant or a Viewer', { canSwitch: false, canEdit: false }],
    ['a locked tab or an event-storming board', { canSwitch: false, canEdit: true }],
  ])('carries no mode switch for %s', (_, gate) => {
    render(
      <EditorModeProvider value={{ mode: 'diagram', setMode: vi.fn(), ...gate }}>
        <ToolbarExplorerButton open={false} onToggle={vi.fn()} />
      </EditorModeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mode:/ })).toBeNull();
  });
});
