'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { dockNaturalWidth } from '@/components/canvas/whiteboard/dock-line-placement';
import { docNameRoom } from './line-room';

// Measures the bottom line and sets `--doc-name-max` on it (line-room), so the document's name shortens before
// anything else gives way. Again whenever the line, a group or Draw's bottom dock changes size; no per-frame work.
// `dockKey` changes as Draw's dock comes, goes or moves between the lines.
export function useLineRoom(line: RefObject<HTMLElement | null>, dockKey: string): void {
  useLayoutEffect(() => {
    const el = line.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const find = (s: string) => el.ownerDocument.querySelector<HTMLElement>(s);
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      const doc = find('[data-document-group]');
      const name = doc?.querySelector<HTMLElement>('[data-doc-name]');
      if (width <= 0 || !doc || !name) return;
      const tools = find('[data-zoom-cluster]')?.getBoundingClientRect().width ?? 0;
      const dock = find('[data-whiteboard-dock][data-dock-position="bottom"]');
      const max = docNameRoom({
        line: width,
        tools,
        document: doc.getBoundingClientRect().width,
        name: name.getBoundingClientRect().width,
        dock: dock ? dockNaturalWidth(dock) : 0,
      });
      el.style.setProperty('--doc-name-max', `${max}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const s of [
      '[data-document-group]',
      '[data-zoom-cluster]',
      '[data-doc-name]',
      '[data-whiteboard-dock] [data-dock-scroller]',
    ]) {
      const target = find(s);
      if (target) observer.observe(target);
    }
    return () => observer.disconnect();
  }, [line, dockKey]);
}
