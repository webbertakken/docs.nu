// @vitest-environment jsdom
// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md): it toggles the Explorer and
// hands itself over as the popover's anchor.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
