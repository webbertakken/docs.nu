import { topLineClearance, TOP_LINE_GAP_PX } from '@/lib/top-line-clearance';

// Where Draw's dock sits on its line (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits";
// docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"): centred between the line's side groups,
// the same clearance on both sides, or on a row of its own just inside the line when it does not fit there (and
// always on a phone). Pure: the hook measures, this decides. Lengths in screen px.

type Box = { left: number; right: number; width: number; height: number };

export type DockLinePlacement = {
  // The clearance on each side while it sits on the line.
  clear: number;
  // On a row of its own: under the top line, or above the bottom line.
  ownRow: boolean;
  // How far the dock stands from the canvas's edge (its top, or its bottom).
  edge: number;
};

// The line's 12px inset from the canvas's edge.
const LINE_INSET_PX = 12;

export function dockLinePlacement(input: {
  position: 'top' | 'bottom';
  view: { left: number; width: number };
  // The top line's brand and actions groups, or the bottom line's tools and document groups.
  start: Box | null;
  end: Box | null;
  // The dock's own width with every button showing (its scroller's).
  dockWidth: number;
  // The line's height where it holds more than its groups' one row (a phone's wrapped bottom line), else the group's.
  lineHeight: number;
  phone: boolean;
}): DockLinePlacement {
  const clear = topLineClearance(input.view, input.start, input.end);
  const fits = input.dockWidth <= input.view.width - 2 * clear;
  const ownRow = input.phone || !fits;
  const edge = ownRow ? LINE_INSET_PX + input.lineHeight + TOP_LINE_GAP_PX : LINE_INSET_PX;
  return { clear, ownRow, edge };
}
