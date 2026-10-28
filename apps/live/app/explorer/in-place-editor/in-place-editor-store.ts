// Which document the Explorer shows in its own place (docs/specs/013-workspace/blueprints/new-document-menu.md "In the
// Explorer's place"): set by startNewDocument as it moves the address to /document/<id>, cleared once the editor may
// go. One at a time: opening another replaces it.
import { useSyncExternalStore } from 'react';

let openId: string | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export function openInPlace(id: string): void {
  openId = id;
  notify();
}

export function closeInPlace(id: string): void {
  if (openId !== id) return;
  openId = null;
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => openId;
const serverSnapshot = () => null;

export function useInPlaceDocument(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
