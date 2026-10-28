'use client';

import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { track } from '@/lib/telemetry';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md §2): this screen stops drawing
// other people's cursor arrows and name pills. Remembered on this device, never synced, like the Keyboard Shortcuts
// switch. Settings and the Collaborators modal each show it; both read this one store, so a flip in either (or in
// another tab) reaches both at once.
//
// Stored as the literal 'true' while on; absent or anything else is off, the default.

export const HIDE_CURSORS_KEY = 'livedoc:v2:hide-cursors';

export function useHideCursors(): { hidden: boolean; setHidden: (next: boolean) => void } {
  const hidden = useLocalStorageValue(HIDE_CURSORS_KEY) === 'true';
  const setHidden = (next: boolean) => {
    // Sent before the write, like every Settings flip (docs/specs/017-telemetry/telemetry.md).
    track('UI', 'Toggled', next ? 'HideCursorsOn' : 'HideCursorsOff');
    writeLocalStorageValue(HIDE_CURSORS_KEY, next ? 'true' : 'false');
  };
  return { hidden, setHidden };
}
