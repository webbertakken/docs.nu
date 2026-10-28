import { DOC_NAME_MIN_PX } from './line-constants';

// How wide the document's name may be (docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"): the
// name gives way first, down to 72px, so the bottom line keeps its groups on one row and Draw's bottom dock centred
// between them. Pure: useLineRoom measures, this decides. Widths in px.
export const LINE_GAP_PX = 8;

export function docNameRoom(input: {
  line: number;
  tools: number;
  document: number;
  name: number;
  // Draw's dock at the bottom, its full width; 0 when it is not on this line.
  dock: number;
}): number {
  // What the document group holds besides its name.
  // Rounded up, so a fraction of a pixel never leaves the dock just short of its room.
  const rest = Math.ceil(input.document - input.name);
  // Beside the tools group.
  let room = input.line - input.tools - LINE_GAP_PX;
  // The dock centred between the groups: each side group within half the line less half the dock.
  if (input.dock > 0) room = Math.min(room, (input.line - input.dock) / 2 - LINE_GAP_PX);
  return Math.max(DOC_NAME_MIN_PX, Math.floor(room - rest));
}
