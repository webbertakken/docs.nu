import { LINE_GAP_PX, LINE_INSET_PX, centreOnLine } from '@/lib/line-centre';

// Where Draw's dock sits on its line (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits";
// docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"), by the rule every line's centre toolbar
// follows (lib/line-centre): centred while it fits centred, else off centre between the line's side groups, else on a
// row of its own just inside the line (and always on a phone). Pure: the hook measures, this decides. Screen px.

type Box = { left: number; right: number; width: number; height: number };

export type DockLinePlacement = {
  // On a row of its own: under the top line, or above the bottom line; centred there.
  ownRow: boolean;
  // While on the line: its left edge from the editor box's left edge, and the width it may take.
  left: number;
  room: number;
  // How far the dock stands from the canvas's edge (its top, or its bottom).
  edge: number;
};

export function dockLinePlacement(input: {
  view: { left: number; width: number };
  // The top line's brand and actions groups, or the bottom line's tools and document groups.
  start: Box | null;
  end: Box | null;
  // The dock's own width with every button showing (dockNaturalWidth).
  dockWidth: number;
  // The line's height (a phone's wrapped bottom line holds two rows).
  lineHeight: number;
  phone: boolean;
}): DockLinePlacement {
  const at = centreOnLine({
    view: input.view,
    start: input.start,
    end: input.end,
    width: input.dockWidth,
  });
  const ownRow = input.phone || !at.fits;
  const edge = ownRow ? LINE_INSET_PX + input.lineHeight + LINE_GAP_PX : LINE_INSET_PX;
  return { ownRow, left: Math.round(at.left), room: Math.floor(at.room), edge };
}

/** The dock's full width on screen with every button showing: its scroller's content and border, at the dock's UI
 *  scale (the wrapper is zoomed, so its box over its layout width). */
export function dockNaturalWidth(dock: HTMLElement): number {
  const scroller = dock.querySelector<HTMLElement>('[data-dock-scroller]');
  const scale = dock.getBoundingClientRect().width / Math.max(1, dock.offsetWidth) || 1;
  return ((scroller?.scrollWidth ?? 0) + 2) * scale;
}
