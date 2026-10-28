// @vitest-environment jsdom
// The Timeline's filter panel (docs/specs/013-workspace/timeline.md §2.3) is portalled to the end of the page, so Tab
// from the Filter button never reached it: it takes focus when it opens and hands it back when it closes.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineFilterPopover } from './TimelineFilterPopover';

afterEach(() => cleanup());

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button">Filter</button>
      {open ? (
        <TimelineFilterPopover
          anchor={new DOMRect(0, 0, 10, 10)}
          mode="list"
          onModeChange={vi.fn()}
          allCategories={[]}
          excluded={new Set()}
          onToggle={vi.fn()}
          onReset={vi.fn()}
          actorFilter="all"
          onActorFilterChange={vi.fn()}
          eventDates={new Set()}
          monthKey="2026-10"
          onMonthChange={vi.fn()}
          onPickDate={vi.fn()}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}

describe('TimelineFilterPopover', () => {
  it('takes focus when it opens and hands it back to the button when it closes', () => {
    const { rerender } = render(<Harness open={false} onClose={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Filter' });
    trigger.focus();
    rerender(<Harness open onClose={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Timeline filters' });
    expect(panel.contains(document.activeElement)).toBe(true);
    rerender(<Harness open={false} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus where someone clicked away to', () => {
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    const onClose = vi.fn();
    const { rerender } = render(<Harness open onClose={onClose} />);
    act(() => outside.focus());
    fireEvent.pointerDown(outside);
    rerender(<Harness open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
