'use client';

import { SettingsRow } from './SettingsRow';
import { useHideCursors } from '@/hooks/collab/useHideCursors';
import type { SettingsHideCursorsRowSpec } from './settings-catalogue';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md §2): per-device, like the
// shortcuts switch, over the store the Collaborators modal's switch shares. The hook sends its own telemetry.
export function SettingsHideCursorsRow({ row }: { row: SettingsHideCursorsRowSpec }) {
  const { hidden, setHidden } = useHideCursors();
  return <SettingsRow row={row} checked={hidden} onChange={setHidden} />;
}
