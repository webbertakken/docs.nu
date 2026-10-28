// @vitest-environment jsdom

// The toolbar group (docs/specs/004-interface-design/toolbar-group.md): one surface for every editor toolbar, parts
// parted by a divider, flat buttons inside.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolbarGroup, ToolbarPart, ToolbarDivider } from './ToolbarGroup';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_CARD,
  TOOLBAR_DIVIDER,
  TOOLBAR_ICON_BUTTON,
} from './toolbar-surface';

afterEach(cleanup);

describe('ToolbarGroup', () => {
  it('draws the palette strip surface, every child centred', () => {
    render(<ToolbarGroup data-testid="g" />);
    const group = screen.getByTestId('g');
    for (const token of TOOLBAR_CARD.split(' ')) expect(group.className).toContain(token);
    expect(group.className).toContain('items-center');
  });

  it('is a named toolbar only when given a label', () => {
    render(
      <>
        <ToolbarGroup label="Document" />
        <ToolbarGroup data-testid="plain" />
      </>,
    );
    expect(screen.getByRole('toolbar', { name: 'Document' })).toBeTruthy();
    expect(screen.getByTestId('plain').getAttribute('role')).toBeNull();
  });

  it('keeps the data attributes and classes its caller measures by', () => {
    render(<ToolbarGroup data-toolbar-menu="" className="absolute left-3" data-testid="g" />);
    const group = screen.getByTestId('g');
    expect(group.hasAttribute('data-toolbar-menu')).toBe(true);
    expect(group.className).toContain('absolute left-3');
  });
});

describe('ToolbarPart', () => {
  it('marks its run for the divider rule and hides when it holds nothing', () => {
    render(
      <ToolbarGroup>
        <ToolbarPart>
          <button type="button">Undo</button>
        </ToolbarPart>
        <ToolbarPart>{null}</ToolbarPart>
      </ToolbarGroup>,
    );
    const parts = document.querySelectorAll('[data-toolbar-part]');
    expect(parts).toHaveLength(2);
    for (const part of parts) expect(part.className).toContain('empty:hidden');
    // A part after a part that drew something opens with the divider's hairline.
    expect(parts[1]!.className).toContain('before:bg-slate-200');
  });
});

describe('ToolbarDivider', () => {
  it('is the 24px hairline, hidden from assistive tech', () => {
    render(<ToolbarDivider data-testid="d" />);
    const divider = screen.getByTestId('d');
    expect(divider.className).toBe(TOOLBAR_DIVIDER);
    expect(divider.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the group buttons', () => {
  it('are flat 36px controls with the hover fill', () => {
    expect(TOOLBAR_BUTTON).toContain('h-9');
    expect(TOOLBAR_BUTTON).toContain('rounded-md');
    expect(TOOLBAR_BUTTON).toContain('hover:bg-slate-100');
    expect(TOOLBAR_BUTTON).not.toContain('border');
    expect(TOOLBAR_ICON_BUTTON).toContain('w-9');
  });
});
