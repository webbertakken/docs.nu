// Where a line's centre toolbar sits (docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"): the
// Palette strip or Draw's dock on the top line, Draw's dock on the bottom line, by one rule. Centred while it keeps
// LINE_GAP_PX clear of both side groups; else as near the centre as it can be while it keeps that gap from each, off
// centre; else it does not fit between them (the strip drops tiles, the name shortens, and last the toolbar takes a
// row of its own). Pure: the hooks measure, this decides. Screen px.

/** The gap the centre toolbar keeps from each side group. */
export const LINE_GAP_PX = 8;
/** A line's inset from the canvas's edges, the bound where a side group is not drawn. */
export const LINE_INSET_PX = 12;

type Edges = { left: number; right: number; width: number };

export type CentrePlacement = {
  // The width the toolbar may take between the groups.
  room: number;
  // Its left edge from the editor box's left edge, while it fits (else where the room starts).
  left: number;
  fits: boolean;
  centred: boolean;
};

const drawn = (e: Edges | null): e is Edges => !!e && e.width > 0;

export function centreOnLine(input: {
  // The editor's box (the window, or its pane in a split).
  view: { left: number; width: number };
  // The line's side groups: the brand and actions groups, or the tools and document groups.
  start: Edges | null;
  end: Edges | null;
  width: number;
}): CentrePlacement {
  const { view, start, end, width } = input;
  const lo = drawn(start) ? start.right + LINE_GAP_PX : view.left + LINE_INSET_PX;
  const hi = drawn(end) ? end.left - LINE_GAP_PX : view.left + view.width - LINE_INSET_PX;
  const room = hi - lo;
  const centre = view.left + (view.width - width) / 2;
  const fits = width <= room;
  const left = fits ? Math.min(Math.max(centre, lo), hi - width) : lo;
  return { room, left: left - view.left, fits, centred: fits && left === centre };
}
