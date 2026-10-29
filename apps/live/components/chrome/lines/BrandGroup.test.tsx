// @vitest-environment jsdom

// The brand group (docs/specs/007-editor/toolbar-layout.md "The top line"): Back, a divider, the menu button, the mode
// switch. The tab's name is no longer here.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { BrandGroup } from './BrandGroup';

afterEach(cleanup);

const modes = {
  mode: 'draw' as const,
  setMode: vi.fn(),
  canSwitch: true,
  canEdit: true,
  workshop: false,
  setWorkshop: vi.fn(),
};

function renderGroup(props: Partial<Parameters<typeof BrandGroup>[0]> = {}, editor = modes) {
  return render(
    <EditorModeProvider value={editor}>
      <BrandGroup
        back={{ kind: 'explorer' }}
        explorer={{ open: false, onToggle: vi.fn() }}
        {...props}
      />
    </EditorModeProvider>,
  );
}

describe('BrandGroup', () => {
  it('holds Back, a divider, the menu button and the mode switch, in that order', () => {
    const { container } = renderGroup();
    const group = container.querySelector('[data-toolbar-menu]')!;
    // Each part is a run a divider parts from the one before (ToolbarPart).
    const parts = [...group.querySelectorAll('[data-toolbar-part]')].map((part) =>
      [...part.querySelectorAll('a, button')].map((el) => el.getAttribute('aria-label')),
    );
    expect(parts).toEqual([['Back to the Explorer'], ['Explorer', 'Editor mode: Sketch']]);
  });

  it('names the mode on a computer, its icon alone on a phone', () => {
    const { rerender } = renderGroup();
    expect(screen.getByRole('button', { name: 'Editor mode: Sketch' }).textContent).toContain(
      'Sketch',
    );
    rerender(
      <EditorModeProvider value={modes}>
        <BrandGroup
          back={{ kind: 'explorer' }}
          explorer={{ open: false, onToggle: vi.fn() }}
          phone
        />
      </EditorModeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Editor mode: Sketch' }).textContent).not.toContain(
      'Sketch',
    );
  });

  it('never carries the tab name', () => {
    const { container } = renderGroup();
    expect(container.querySelector('[data-tab-name-in-box]')).toBeNull();
    expect(container.querySelector('[data-menu-name-slot]')).toBeNull();
  });

  it('carries no mode switch for a Participant or a Viewer', () => {
    renderGroup({}, { ...modes, canSwitch: false, canEdit: false });
    expect(screen.queryByRole('button', { name: /mode:/ })).toBeNull();
  });

  it('in a workspace frame, has the frame Back and no menu button', () => {
    renderGroup({ back: { kind: 'frame', back: vi.fn(), backTitle: 'Roadmap' }, explorer: null });
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Explorer' })).toBeNull();
  });

  it('is the editor header region for F6, floating chrome the canvas skips', () => {
    const { container } = renderGroup();
    const group = container.querySelector('[data-toolbar-menu]')!;
    expect(group.getAttribute('data-region')).toBe('header');
    expect(group.hasAttribute('data-floating-panel')).toBe(true);
    expect(group.hasAttribute('data-dock-button')).toBe(true);
  });
});
