'use client';

import { useEffect, useState } from 'react';

// Reveal something after `delayMs`, but only while `enabled` is true.
// Returns false until the timer fires, then true. Used for a sheet
// cell's comment preview, which waits for a hover to settle.
//
// The timer is tied to `enabled`: it starts when `enabled` becomes
// true and is cleared if `enabled` goes false (e.g. the pointer
// leaves), resetting `revealed` so a later
// re-enable waits the full delay again. Keep `enabled` free of
// transient flags you don't want to restart the
// countdown; gate those on the returned value at render time instead.
export function useDelayedReveal(delayMs: number, enabled = true): boolean {
  const [revealed, setRevealed] = useState(false);
  // Disabling hides at once (adjusted during render, not a frame later in an
  // effect), and clears the reveal so a later re-enable waits again.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (!enabled) setRevealed(false);
  }

  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, enabled]);

  return revealed;
}
