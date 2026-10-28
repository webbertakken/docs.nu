'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// Whether the top line's centre toolbar (the Palette strip, or Draw's dock at the top) has taken a row of its own under
// the line (docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"). The toolbar knows (it measures
// itself); the top corner stacks follow it a row lower. A module store: one centre toolbar is drawn at a time.
let ownRow = false;
const listeners = createListeners();

function set(next: boolean): void {
  if (next === ownRow) return;
  ownRow = next;
  listeners.notify();
}

/** Says, while mounted, whether the centre toolbar sits on its own row; it stands down with the toolbar. */
export function useReportCentreOwnRow(next: boolean): void {
  useLayoutEffect(() => set(next), [next]);
  useLayoutEffect(() => () => set(false), []);
}

const read = () => ownRow;
const never = () => false;
/** Whether the centre toolbar is on its own row. */
export function useCentreOwnRow(): boolean {
  return useSyncExternalStore(listeners.subscribe, read, never);
}
