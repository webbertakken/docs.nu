'use client';

import { useEditorModeState } from './editor-mode-context';
import { ModeMenuChip } from './ModeMenuChip';

// The top chrome's mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a compact dropdown chip
// (ModeMenuChip) right of the menu button, in its card, on every tab an Editor may switch, empty or not. It reads the
// editor's own resolved mode (EditorModeProvider), so it shows the mode the canvas is in, and the start's switch
// (StartModeSwitch) reads the same, so the two always agree.
//
// The same visibility and rules as the start's switch: nothing outside an editor or for a Participant or a Viewer
// (canEdit is an Editor's alone), nothing on a locked tab or an event-storming board (canSwitch); a Board, Sheet or
// Dashboard tab shows it with its lock, offering a new tab in another mode (lockedReason).
//
// The chip takes only the width its content needs, so a short name (Draw) leaves no empty space. `iconOnly` (a phone,
// the strip's row) drops the name to save room; the chip keeps its accessible name.
export function EditorModeSwitch({ iconOnly = false }: { iconOnly?: boolean }) {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || (!editorMode.canSwitch && !editorMode.lockedReason)) return null;
  return (
    <div data-editor-mode-switch="" className="flex shrink-0">
      <ModeMenuChip
        mode={editorMode.mode}
        onChange={editorMode.setMode}
        newTabIn={editorMode.newTabIn}
        crossPlan={editorMode.crossPlan}
        {...(editorMode.canSwitch ? {} : { lockedReason: editorMode.lockedReason })}
        compact
        iconOnly={iconOnly}
      />
    </div>
  );
}
