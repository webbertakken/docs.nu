import {
  EDITOR_MODES,
  editorModeLabel,
  modesBesidePlanRule,
  nextEditorMode,
} from '@livedoc/document';
import type { EditorModeState } from './useEditorMode';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Draw mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Wherever the switch is offered: an empty tab (crossPlan) cycles every
// mode, a tab with content the modes on its side of Plan's line, so a Plan tab with content has none. Null where
// the switch is not offered (a Participant or a Viewer, a locked tab, an event-storming board), so the key does
// nothing there.
export function editorModeShortcut(
  { mode, setMode, canSwitch, crossPlan }: EditorModeState,
  announce: (message: string) => void,
): (() => void) | null {
  const modes = crossPlan ? EDITOR_MODES : modesBesidePlanRule(mode);
  if (!canSwitch || modes.length < 2) return null;
  return () => {
    const next = nextEditorMode(mode, 1, modes);
    setMode(next);
    announce(`${editorModeLabel(next)} mode`);
  };
}
