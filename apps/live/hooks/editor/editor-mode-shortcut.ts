import { editorModeLabel, nextEditorMode } from '@livedoc/document';
import type { EditorModeState } from './useEditorMode';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Sketch mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Wherever the switch is offered it cycles Sketch, Structured and Pages.
// Null where the switch is not offered (a Participant or a Viewer, a locked tab, an event-storming board, a Plan
// tab), so the key does nothing there.
export function editorModeShortcut(
  { mode, setMode, canSwitch }: EditorModeState,
  announce: (message: string) => void,
): (() => void) | null {
  if (!canSwitch) return null;
  return () => {
    const next = nextEditorMode(mode);
    setMode(next);
    announce(`${editorModeLabel(next)} mode`);
  };
}
