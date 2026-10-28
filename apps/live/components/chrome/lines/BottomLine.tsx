'use client';

import type { ReactNode } from 'react';
import { atLeastInset } from '@livedoc/ui';

// The bottom line (docs/specs/007-editor/toolbar-layout.md "The bottom line"): the tools group at the left, the
// document group at the right, one row while they fit with an 8px gap. When they do not (a phone), the line wraps
// upward: the document group takes the row above the tools group, keeping its right corner. 12px from the canvas's
// edges, or clear of the home indicator and a landscape notch; `inset` adds to that (a board covering the canvas
// keeps the line inside its frame, Pages' pinned Contents keeps it beside the sidebar).
export function BottomLine({
  tools,
  document,
  inset = { left: 0, right: 0, bottom: 0 },
}: {
  tools: ReactNode;
  document: ReactNode;
  inset?: { left: number; right: number; bottom: number };
}) {
  return (
    <div
      data-bottom-line=""
      style={{
        left: atLeastInset(`${12 + inset.left}px`, 'left'),
        right: atLeastInset(`${12 + inset.right}px`, 'right'),
        bottom: atLeastInset(`${12 + inset.bottom}px`, 'bottom'),
      }}
      className="pointer-events-none absolute z-[var(--z-panel)] flex flex-wrap-reverse items-end gap-2"
    >
      {tools}
      {document}
    </div>
  );
}
