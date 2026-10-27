// @vitest-environment jsdom

// docs/specs/007-editor/live-app.md: Layers and the Theme & Canvas brush share one strip in every
// mode, and a session without one of the two keeps the other. The cluster names nothing: each is its
// icon alone on every width, and there is no Tidy Up button.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayersThemeStrip } from './LayersThemeStrip';

afterEach(cleanup);

describe('LayersThemeStrip', () => {
  it('puts Layers and the brush in one strip', () => {
    const onToggle = vi.fn();
    const onOpenTheme = vi.fn();
    render(<LayersThemeStrip layers={{ open: false, onToggle }} onOpenTheme={onOpenTheme} />);
    const layers = screen.getByRole('button', { name: 'Open Layers' });
    const theme = screen.getByRole('button', { name: 'Theme and canvas' });
    expect(layers.closest('[data-dock-button]')).toBe(theme.closest('[data-dock-button]'));
    fireEvent.click(layers);
    expect(onToggle).toHaveBeenCalledWith(layers);
    fireEvent.click(theme);
    expect(onOpenTheme).toHaveBeenCalled();
  });

  it('keeps whichever of the two a mode has, and nothing when it has neither', () => {
    render(<LayersThemeStrip onOpenTheme={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Layers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Theme and canvas' })).toBeTruthy();
    cleanup();
    const { container } = render(<LayersThemeStrip />);
    expect(container.innerHTML).toBe('');
  });

  it('shows both as icons alone on a wide desktop, named only for assistive tech', () => {
    // Every media query matches: the widest desktop there is.
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    render(
      <LayersThemeStrip layers={{ open: false, onToggle: () => {} }} onOpenTheme={() => {}} />,
    );
    const strip = screen
      .getByRole('button', { name: 'Open Layers' })
      .closest('[data-dock-button]')!;
    const buttons = [...strip.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Open Layers',
      'Theme and canvas',
    ]);
    expect(buttons.map((b) => b.textContent)).toEqual(['', '']);
  });
});
