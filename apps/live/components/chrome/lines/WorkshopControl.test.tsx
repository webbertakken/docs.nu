// @vitest-environment jsdom

// The Workshop control (docs/specs/012-collaboration/workshop-mode.md "The control"): the actions group's flat
// toggle, its label fixed, its state in aria-pressed and the brand fill.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkshopControl } from './WorkshopControl';

afterEach(cleanup);

const button = () => screen.getByRole('button', { name: 'Workshop' });

describe('WorkshopControl', () => {
  it('is a toggle named Workshop, off', () => {
    render(<WorkshopControl on={false} onToggle={vi.fn()} />);
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().textContent).toBe('Workshop');
    expect(button().hasAttribute('data-workshop-control')).toBe(true);
    expect(button().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows on with the brand fill, its label unchanged (no layout shift)', () => {
    const { rerender } = render(<WorkshopControl on={false} onToggle={vi.fn()} />);
    const off = button().className;
    rerender(<WorkshopControl on onToggle={vi.fn()} />);
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().textContent).toBe('Workshop');
    expect(button().className).not.toBe(off);
    expect(button().className).toContain('bg-brand-700');
  });

  it('is its mark alone unless Button Labels is on, its name read out either way', () => {
    const { rerender } = render(<WorkshopControl on={false} onToggle={vi.fn()} />);
    expect(button().querySelector('span')!.className).toContain('sr-only');
    rerender(<WorkshopControl on={false} onToggle={vi.fn()} labelled />);
    expect(button().querySelector('span')!.className).not.toMatch(/(^|\s)sr-only/);
    expect(button().querySelector('span')!.className).toContain('phone:sr-only');
  });

  it('asks to turn it the other way', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<WorkshopControl on={false} onToggle={onToggle} />);
    fireEvent.click(button());
    expect(onToggle).toHaveBeenLastCalledWith(true);
    rerender(<WorkshopControl on onToggle={onToggle} />);
    fireEvent.click(button());
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });
});
