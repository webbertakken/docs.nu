'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { ACTIONS_GROUP_SELECTOR, BRAND_GROUP_SELECTOR } from '@/lib/top-line-clearance';
import { dockLinePlacement, type DockLinePlacement } from './dock-line-placement';

// The line's side groups the dock sits between, by where it is.
const SIDES = {
  top: [BRAND_GROUP_SELECTOR, ACTIONS_GROUP_SELECTOR],
  bottom: ['[data-zoom-cluster]', '[data-document-group]'],
} as const;

// Measures where Draw's dock sits on its line (dock-line-placement), from the real sizes: the side groups, the dock's
// own full width and the bottom line's height, again whenever any of them changes size. Null until measured, when the
// dock takes the line's 12px and the class fallbacks hold.
export function useDockLinePlacement(
  wrapper: RefObject<HTMLElement | null>,
  position: 'top' | 'bottom',
  phone: boolean,
): DockLinePlacement | null {
  const [placement, setPlacement] = useState<DockLinePlacement | null>(null);
  useLayoutEffect(() => {
    const own = wrapper.current;
    const container = own?.offsetParent ?? own?.parentElement;
    if (!own || !container) return;
    const find = (s: string) => document.querySelector<HTMLElement>(s);
    const measure = () => {
      const view = container.getBoundingClientRect();
      // Not laid out yet (or hidden): nothing to measure.
      if (view.width <= 0) return;
      const [start, end] = SIDES[position].map((s) => find(s)?.getBoundingClientRect() ?? null);
      const scroller = own.querySelector<HTMLElement>('[data-dock-scroller]');
      const scale = own.getBoundingClientRect().width / Math.max(1, own.offsetWidth) || 1;
      const line = position === 'bottom' ? find('[data-bottom-line]') : find(BRAND_GROUP_SELECTOR);
      const next = dockLinePlacement({
        position,
        view,
        start: start ?? null,
        end: end ?? null,
        dockWidth: ((scroller?.scrollWidth ?? 0) + 2) * scale,
        lineHeight: line?.getBoundingClientRect().height ?? 46,
        phone,
      });
      setPlacement((prev) =>
        prev &&
        prev.ownRow === next.ownRow &&
        Math.round(prev.clear) === Math.round(next.clear) &&
        Math.round(prev.edge) === Math.round(next.edge)
          ? prev
          : next,
      );
    };
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver === 'undefined')
      return () => window.removeEventListener('resize', measure);
    // One observer for everything the placement reads: no per-frame work.
    const observer = new ResizeObserver(measure);
    for (const s of [...SIDES[position], '[data-bottom-line]', '[data-dock-scroller]']) {
      const el = s === '[data-dock-scroller]' ? own.querySelector<HTMLElement>(s) : find(s);
      if (el) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [wrapper, position, phone]);
  return placement;
}
