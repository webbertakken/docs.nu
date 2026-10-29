// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Jump Back In (docs/specs/013-workspace/explorer-home.md "Jump Back In"): on a desktop or tablet one
// 4 by 2 grid with no group titles, most used on top and recent below, each tile its thumbnail and
// name, See More in the heading row; on a phone a strip that alternates and ends in a See More
// tile. A local document carries the This Browser pill.

const { track, wide } = vi.hoisted(() => ({ track: vi.fn(), wide: { value: true } }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string; offline?: boolean }) => (
    <span data-testid={`thumb-${p.documentId}`} data-offline={String(Boolean(p.offline))} />
  ),
}));
vi.mock('@livedoc/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livedoc/ui')>()),
  useMediaQuery: () => wide.value,
}));

import { JumpBackIn } from './JumpBackIn';
import type { JumpBackInSet } from '@/app/explorer/home/home-model';
import { fixtureJumpItem as item } from './home-test-utils';

const set = (mostUsed: string[], recent: string[]): JumpBackInSet => ({
  mostUsed: mostUsed.map((id) => item(id)),
  recent: recent.map((id) => item(id)),
});

function renderIt(s: JumpBackInSet, onSeeMore = vi.fn()) {
  render(
    <JumpBackIn
      ownerId="me"
      set={s}
      loading={false}
      recentHref="/explorer/recent"
      onSeeMore={onSeeMore}
    />,
  );
  return onSeeMore;
}

const names = (links: HTMLElement[]) => links.map((l) => l.getAttribute('aria-label'));

beforeEach(() => track.mockReset());

describe('JumpBackIn, desktop and tablet', () => {
  beforeEach(() => {
    wide.value = true;
  });

  it('lists the most used on the top row, then the recent, as one list with no group titles', () => {
    renderIt(set(['m1', 'm2', 'm3', 'm4'], ['r1', 'r2', 'r3', 'r4']));
    const list = screen.getByRole('list', { name: 'Jump Back In' });
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(names(within(list).getAllByRole('link'))).toEqual([
      'Doc m1',
      'Doc m2',
      'Doc m3',
      'Doc m4',
      'Doc r1',
      'Doc r2',
      'Doc r3',
      'Doc r4',
    ]);
    // Calm by default: the section's heading is the only title.
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.queryByText('Most Used')).toBeNull();
    expect(screen.queryByText('Recent')).toBeNull();
    const first = within(list).getAllByRole('link')[0]!;
    expect(first.getAttribute('href')).toBe('/document/m1');
    // Thumbnail tiles, four across.
    expect(list.className).toContain('grid-cols-4');
  });

  it('starts the recent on the second row, whatever the length of the first', () => {
    renderIt(set(['m1', 'm2'], ['r1', 'r2']));
    const items = within(screen.getByRole('list', { name: 'Jump Back In' })).getAllByRole(
      'listitem',
    );
    expect(items.map((li) => li.className.includes('col-start-1'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('lets the recent take the top row when nothing is most used yet', () => {
    renderIt(set([], ['r1', 'r2']));
    const list = screen.getByRole('list', { name: 'Jump Back In' });
    expect(names(within(list).getAllByRole('link'))).toEqual(['Doc r1', 'Doc r2']);
    expect(within(list).getAllByRole('listitem')[0]!.className).not.toContain('col-start-1');
  });

  it('draws each tile as its thumbnail and name alone, with no line saying why it is there', () => {
    const now = Date.now();
    renderIt({
      mostUsed: [item('m1', { useDays: 14 })],
      recent: [item('r1', { lastUsedAt: now - 2 * 3_600_000 })],
    });
    for (const name of ['Doc m1', 'Doc r1']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('aria-describedby')).toBeNull();
      expect(link.textContent).toBe(name);
    }
    expect(screen.queryByText(/^Used /)).toBeNull();
  });

  it("keeps two rows' height whatever lands in it", () => {
    renderIt(set(['m1'], []));
    expect(screen.getByRole('list', { name: 'Jump Back In' }).className).toContain(
      'min-h-[13.25rem]',
    );
  });

  it('tracks which half a document was opened from', () => {
    renderIt(set(['m1'], ['r1']));
    fireEvent.click(screen.getByRole('link', { name: 'Doc m1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.MostUsed');
    fireEvent.click(screen.getByRole('link', { name: 'Doc r1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.Recent');
  });

  it('puts See More in the heading row, navigating in the app on a plain click', () => {
    const onSeeMore = renderIt(set(['m1'], []));
    const link = screen.getByRole('link', { name: 'See More' });
    expect(link.getAttribute('href')).toBe('/explorer/recent');
    expect(link.parentElement!.querySelector('h2')!.textContent).toBe('Jump Back In');
    fireEvent.click(link);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn.SeeMore');
    fireEvent.click(link, { ctrlKey: true });
    expect(onSeeMore).toHaveBeenCalledTimes(1);
  });

  it('shows no See More while it loads', () => {
    render(
      <JumpBackIn ownerId="me" set={set([], [])} loading recentHref="/r" onSeeMore={() => {}} />,
    );
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
  });

  it('marks a document stored only in this browser', () => {
    renderIt({ mostUsed: [item('l', { localOnly: true })], recent: [] });
    const link = screen.getByRole('link', { name: 'Doc l, This Browser' });
    expect(within(link).getByText('This Browser')).toBeTruthy();
    expect(screen.getByTestId('thumb-l').dataset.offline).toBe('true');
  });

  it('says what will gather here when there is nothing yet', () => {
    renderIt(set([], []));
    expect(screen.getByText('No documents yet')).toBeTruthy();
    expect(screen.getByText('The documents you use most and last will gather here.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    // Nothing to see more of.
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    // In place of the first tiles: a tile's height, from the first column.
    const slot = screen.getByText('No documents yet').closest('[data-empty-state]')!.parentElement!;
    expect(slot.className).toContain('h-[6.25rem]');
    expect(slot.className).toContain('border-dashed');
    expect(slot.parentElement!.className).toContain('grid-cols-4');
  });
});

describe('JumpBackIn, phone', () => {
  beforeEach(() => {
    wide.value = false;
  });

  it('alternates most used and recent, then ends in a See More tile outside the list', () => {
    const onSeeMore = renderIt(set(['m1', 'm2'], ['r1', 'r2', 'r3']));
    const list = screen.getByRole('list', { name: 'Jump Back In' });
    expect(names(within(list).getAllByRole('link'))).toEqual([
      'Doc m1',
      'Doc r1',
      'Doc m2',
      'Doc r2',
      'Doc r3',
    ]);
    const seeMore = screen.getAllByRole('link', { name: 'See More' });
    // The tile only: no second See More in the heading row.
    expect(seeMore).toHaveLength(1);
    expect(list.contains(seeMore[0]!)).toBe(false);
    fireEvent.click(seeMore[0]!);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn.SeeMore');
  });

  it('tracks the half a tile came from, wherever it sits', () => {
    renderIt(set(['m1'], ['r1']));
    fireEvent.click(screen.getByRole('link', { name: 'Doc r1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.Recent');
  });

  it('fades the trailing edge only while more lies to the right', () => {
    renderIt(set(['a'], ['b']));
    const scroller = screen.getByRole('list', { name: 'Jump Back In' }).parentElement!;
    const fade = scroller.nextElementSibling as HTMLElement;
    Object.defineProperties(scroller, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 600, configurable: true },
      scrollLeft: { value: 0, configurable: true, writable: true },
    });
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-100');
    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-0');
  });

  it('shows no See More tile beside the empty state', () => {
    renderIt(set([], []));
    expect(screen.getByText('No documents yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
  });
});
