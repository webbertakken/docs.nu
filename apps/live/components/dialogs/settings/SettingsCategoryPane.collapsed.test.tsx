// @vitest-environment jsdom

// A closed section (docs/specs/007-editor/element-tours.md "Settings"): the Tours' Show Me section (element tours) sits in a closed
// accordion naming how many are on, opened by its heading, or on its own when Settings lands on one of its rows.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { ELEMENT_TOUR_KINDS } from '@/lib/element-tours';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(cleanup);
// Landing on a row scrolls it into view, which jsdom does not lay out.
Element.prototype.scrollIntoView = vi.fn();

const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
// The section's heading names it Show Me and says how many are on.
// Opted in to every Show Me; nobody is offered one by default.
const OPTED_IN = { elementTourOffers: [...ELEMENT_TOUR_KINDS] };
const header = () => screen.getByRole('button', { name: /^Show Me/ });

describe('Show Me section (element tours)', () => {
  it('reads every switch off for someone who never opted in', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{}}
        onChange={vi.fn()}
        focusRowKey="elementTour-flowchart"
      />,
    );
    expect(
      screen.getByRole('switch', { name: 'Show Me on Every Element' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByRole('switch', { name: 'Flowchart' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('starts closed, saying how many tours are on', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(header().textContent).toContain('0 of 21 On');
    // The mode tours stay open above it.
    expect(screen.getByRole('switch', { name: 'Draw Tour' })).toBeTruthy();
  });

  it('opens from its heading, the master switch over each element', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(header().getAttribute('aria-expanded')).toBe('true');
    const group = screen.getByRole('group', { name: 'Show Me on Every Element settings' });
    expect(group.textContent).toContain('Sankey Diagram');
  });

  it('counts an answered tour as off', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ ...OPTED_IN, elementTourKinds: ['sankey'] }}
        onChange={vi.fn()}
      />,
    );
    expect(header().textContent).toContain('20 of 21 On');
  });

  it('opens on its own when Settings lands on one of its rows', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{}}
        onChange={vi.fn()}
        focusRowKey="elementTour-sankey"
      />,
    );
    expect(header().getAttribute('aria-expanded')).toBe('true');
  });

  it('offers the Sankey tour again when its switch is turned on', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ ...OPTED_IN, elementTourKinds: ['sankey'] }}
        onChange={onChange}
        focusRowKey="elementTour-sankey"
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Sankey Diagram' }));
    expect(onChange).toHaveBeenCalledWith({
      ...OPTED_IN,
      elementTourKinds: [],
      elementToursSeen: false,
    });
  });

  it('opts a tour in when its switch is turned on for someone who never opted in', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{}}
        onChange={onChange}
        focusRowKey="elementTour-flowchart"
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Flowchart' }));
    expect(onChange).toHaveBeenCalledWith({
      elementTourOffers: ['flowchart'],
      elementTourKinds: [],
      elementToursSeen: false,
    });
  });

  it('brings what it unfolded into view once it has eased open', () => {
    vi.useFakeTimers();
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(scroll).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    vi.useRealTimers();
  });
});
