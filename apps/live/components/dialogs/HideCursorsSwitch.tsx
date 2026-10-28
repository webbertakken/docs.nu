'use client';

import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';
import { useHideCursors } from '@/hooks/collab/useHideCursors';

// The Hide Participant Cursors switch at the foot of the Collaborators modal
// (docs/specs/012-collaboration/collaborator-enhancements.md §2): the same switch Settings shows under Collaborate,
// one click away when a session gets busy. Its words are the Settings row's too.
export const HIDE_CURSORS_LABEL = 'Hide Participant Cursors';
export const HIDE_CURSORS_HINT =
  "Stops drawing other people's cursors and names on your screen. Avatars and Follow stay. Saved on this device only.";

export function HideCursorsSwitch() {
  const { hidden, setHidden } = useHideCursors();
  return (
    <SettingsToggleRow
      label={HIDE_CURSORS_LABEL}
      hint={HIDE_CURSORS_HINT}
      checked={hidden}
      onToggle={() => setHidden(!hidden)}
    />
  );
}
