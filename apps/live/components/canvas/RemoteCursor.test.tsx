// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HIDE_CURSORS_KEY } from '@/hooks/collab/useHideCursors';
import { writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { storageEvent } from '@/lib/testing/storage-event';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { RemoteCursor, RemoteCursors, type RemoteCursorRow } from './RemoteCursor';

// Another participant's cursor (docs/specs/012-collaboration/collaborator-enhancements.md §2 and §3): drawn at its
// canvas point at a constant size on screen, never taking a click, and not at all while this screen hides them.

afterEach(() => {
  window.localStorage.clear();
  act(() => {
    window.dispatchEvent(storageEvent({ key: null }));
  });
});

const ada: RemoteCursorRow = { id: 'a', name: 'Ada Lovelace', color: '#0ea5e9', x: 120, y: 40 };
const bo: RemoteCursorRow = { id: 'b', name: 'Bo', color: '#10b981', x: 300, y: 90 };

describe('RemoteCursor', () => {
  it('sits at its canvas point, counter-scaled to keep its size on screen, and never takes a click', () => {
    const { container } = render(<RemoteCursor cursor={ada} zoom={2} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
    expect(root.className).not.toContain('opacity-0');
    expect(root.style.left).toBe('120px');
    expect(root.style.top).toBe('40px');
    expect(root.style.transform).toBe('scale(0.5)');
    expect(root.querySelector('svg')?.getAttribute('fill')).toBe('#0ea5e9');
    expect(root.querySelector('span')?.textContent).toBe('Ada Lovelace');
  });

  it('fades out, still letting clicks through, while it steps aside', () => {
    const { container } = render(<RemoteCursor cursor={ada} zoom={1} faded />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('opacity-0');
    expect(root.className).toContain('pointer-events-none');
    expect(root.className).toContain('motion-safe:transition-opacity');
  });
});

describe('RemoteCursors', () => {
  it('draws every cursor at the canvas zoom', () => {
    const { container } = render(
      <CanvasZoomProvider zoom={4}>
        <RemoteCursors cursors={[ada, bo]} />
      </CanvasZoomProvider>,
    );
    const roots = [...container.querySelectorAll<HTMLElement>('[data-remote-cursor]')];
    expect(roots.map((r) => r.textContent)).toEqual(['Ada Lovelace', 'Bo']);
    expect(roots[0]!.style.transform).toBe('scale(0.25)');
  });

  it('draws none while this screen hides participant cursors, and all again when it stops', () => {
    const { container } = render(<RemoteCursors cursors={[ada, bo]} />);
    const drawn = () => container.querySelectorAll('[data-remote-cursor]').length;
    expect(drawn()).toBe(2);
    act(() => writeLocalStorageValue(HIDE_CURSORS_KEY, 'true'));
    expect(drawn()).toBe(0);
    act(() => writeLocalStorageValue(HIDE_CURSORS_KEY, 'false'));
    expect(drawn()).toBe(2);
  });
});
