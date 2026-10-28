'use client';

import type { ReactNode } from 'react';
import { atLeastInset, safeInset } from '@livedoc/ui';

// The top line's side groups (docs/specs/007-editor/toolbar-layout.md "The top line"): the brand group at the left, the
// actions group at the right, 12px from the canvas's edges (or clear of a notch). The centre toolbar (the Palette strip
// or Draw's dock) is drawn on its own layer and keeps clear of both (lib/top-line-clearance). Where the two side
// groups alone do not fit (a narrow phone) the actions group gives way and swipes sideways, the brand group whole.
export function TopLine({ brand, actions }: { brand: ReactNode; actions: ReactNode }) {
  return (
    <div
      data-top-line=""
      style={{
        top: `calc(0.75rem + ${safeInset('top')})`,
        left: atLeastInset('0.75rem', 'left'),
        right: atLeastInset('0.75rem', 'right'),
      }}
      className="pointer-events-none absolute z-[var(--z-toolbar)] flex items-start justify-between gap-2"
    >
      {brand}
      {actions}
    </div>
  );
}
