// @vitest-environment jsdom

// The mode menu (docs/specs/007-editor/editor-modes.md "The mode switch"): a plain dropdown of the three modes,
// Sketch, Structured and Pages, each its mark and its name, a check on the current one. No preview, no
// descriptions, no tool chips. It opens from the switch's chip and keeps the menu keyboard.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livedoc/document';
import { ModeMenuChip } from './ModeMenuChip';

afterEach(cleanup);

function open(mode: EditorMode, compact = true): ReturnType<typeof vi.fn> {
  const onChange = vi.fn();
  render(<ModeMenuChip mode={mode} onChange={onChange} compact={compact} />);
  fireEvent.click(screen.getByRole('button', { name: /mode:/ }));
  return onChange;
}

const rows = () => screen.getAllByRole('menuitemradio');
const row = (name: string) => screen.getByRole('menuitemradio', { name });

describe('ModeMenu', () => {
  it('lists Sketch, Structured and Pages, in that order, by name alone', () => {
    open('diagram');
    expect(rows().map((r) => r.textContent)).toEqual(['Sketch', 'Structured', 'Pages']);
    expect(rows().map((r) => r.dataset.modeRow)).toEqual(['draw', 'diagram', 'pages']);
  });

  it('checks the current mode only, and draws its check', () => {
    open('pages');
    expect(rows().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    expect(row('Pages').querySelector('[data-mode-check]')).not.toBeNull();
    expect(row('Sketch').querySelector('[data-mode-check]')).toBeNull();
  });

  it('holds no preview, no descriptions and no tool chips', () => {
    open('diagram');
    const menu = document.querySelector<HTMLElement>('[data-mode-menu]')!;
    expect(menu.querySelector('[data-mode-preview]')).toBeNull();
    for (const r of rows()) {
      expect(r.hasAttribute('aria-describedby')).toBe(false);
      expect(r.querySelectorAll('svg')).toHaveLength(
        r.getAttribute('aria-checked') === 'true' ? 2 : 1,
      );
    }
    expect(menu.querySelectorAll('li')).toHaveLength(0);
  });

  it('is one menu named for the editor mode, 220px wide at least', () => {
    open('draw');
    const menu = screen.getByRole('menu', { name: 'Editor mode' });
    expect(menu.style.minWidth).toBe('220px');
  });

  it('switches from a clicked row, and closes', () => {
    const onChange = open('diagram');
    fireEvent.click(row('Sketch'));
    expect(onChange).toHaveBeenCalledWith('draw');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes without a change when the current row is chosen', () => {
    const onChange = open('diagram');
    fireEvent.click(row('Structured'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('switches from the keyboard: the arrows move, Enter chooses', () => {
    const onChange = open('diagram');
    expect(document.activeElement).toBe(row('Structured'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Pages'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Sketch'));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('draw');
  });

  it('closes on Escape, returning focus to the chip', () => {
    open('pages');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editor mode: Pages' }));
  });

  it('opens from the named chip, which says Shift+D and is what the Leave Pages card hangs from', () => {
    open('draw', false);
    const chip = screen.getByRole('button', { name: 'Tab mode: Sketch' });
    expect(chip.hasAttribute('data-mode-switch')).toBe(true);
    expect(chip.getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    expect(chip.getAttribute('aria-expanded')).toBe('true');
  });
});
