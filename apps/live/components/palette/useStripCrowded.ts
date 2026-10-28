'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { editorViewportOf } from '@/lib/editor-viewport';
import { measureTopLineClearance, topLineGroups } from '@/lib/top-line-clearance';

// Whether the centred strip would run under the top-left menu card (docs/specs/007-editor/toolbar-layout.md "The
// category bar"): the strip as drawn is wider than the room centring leaves it, the editor's width less the menu
// card on both sides. The category bar drops its names to fit and can drop nothing more, so on a tablet (768px) its
// glyphs alone still ran 13px under the card, cutting the tab's name. Crowded, the strip sits at the right instead,
// clear of the card. Measured from the real sizes, as useBarLabels and useStripTileLimit are.

export function useStripCrowded(cardRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [crowded, setCrowded] = useState(false);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = card.getBoundingClientRect().width;
      if (width <= 0) return;
      const view = editorViewportOf(card);
      // Clear of both side groups of the top line (lib/top-line-clearance).
      const clear = measureTopLineClearance(view);
      setCrowded(width > view.width - 2 * clear);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    for (const group of topLineGroups()) observer.observe(group);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [cardRef, enabled]);
  return enabled && crowded;
}
