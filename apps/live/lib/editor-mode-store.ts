// The tab's editor mode (docs/specs/007-editor/editor-modes.md "Where the mode lives"): stored on
// the tab and the same for everyone on it. Pure resolution; the hook (useEditorMode) binds it to
// the editor and makes a switch one tab edit.
//
// - The mode is the tab's own (`Tab.opensIn`), Structured when absent. Nothing is remembered per
//   person: the `livedoc:v2:editor-mode:<tab>` keys an earlier editor wrote are left in
//   place and never read.
// - Event-storming boards are always Structured and offer no switch; a Plan tab is always in Plan and offers none.
// - A view-role visitor, and everyone on a locked tab, follows the tab's mode and gets no switch.
import { editorModeSwitchable, opensInOf, type EditorMode, type Tab } from '@livedoc/document';

export type EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers' | 'locked'>;

type ResolvedEditorMode = { mode: EditorMode; canSwitch: boolean };

export function resolveEditorMode(input: {
  tab: EditorModeTab | undefined;
  canEdit: boolean;
}): ResolvedEditorMode {
  const { tab, canEdit } = input;
  const canSwitch = !!tab && editorModeSwitchable(tab) && canEdit && tab.locked !== true;
  return { mode: opensInOf(tab), canSwitch };
}
