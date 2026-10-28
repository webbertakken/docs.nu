// The room the top line's side groups take from the centre toolbar (docs/specs/007-editor/toolbar-layout.md "When a
// line runs out of room"): the strip (or Draw's dock) is centred, so it keeps clear of the wider of the brand group
// at the left (`[data-toolbar-menu]`) and the actions group at the right (`[data-toolbar-actions]`), the same on both
// sides, plus the line's gap. A group not drawn (or hidden, zero wide) takes nothing.

export const TOP_LINE_GAP_PX = 8;
export const BRAND_GROUP_SELECTOR = '[data-toolbar-menu]';
export const ACTIONS_GROUP_SELECTOR = '[data-toolbar-actions]';

type Edges = { left: number; right: number; width: number };
// The editor's box (lib/editor-viewport): its left edge and width.
type View = { left: number; width: number };

/** The clearance on each side of a centred toolbar in `view`, from the side groups' boxes. */
export function topLineClearance(view: View, brand: Edges | null, actions: Edges | null): number {
  const left = brand && brand.width > 0 ? brand.right - view.left : 0;
  const right = actions && actions.width > 0 ? view.left + view.width - actions.left : 0;
  const widest = Math.max(left, right);
  return widest > 0 ? widest + TOP_LINE_GAP_PX : 0;
}

/** The side groups on the page, for a hook to observe and measure. */
export function topLineGroups(): HTMLElement[] {
  return [BRAND_GROUP_SELECTOR, ACTIONS_GROUP_SELECTOR]
    .map((s) => document.querySelector<HTMLElement>(s))
    .filter((el): el is HTMLElement => el !== null);
}

/** The clearance for the page as it is drawn now. */
export function measureTopLineClearance(view: View): number {
  const box = (s: string) =>
    document.querySelector<HTMLElement>(s)?.getBoundingClientRect() ?? null;
  return topLineClearance(view, box(BRAND_GROUP_SELECTOR), box(ACTIONS_GROUP_SELECTOR));
}
