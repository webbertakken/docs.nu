import { centreOnLine, type CentrePlacement } from './line-centre';

// The top line's side groups as the centre toolbar (the Palette strip, or Draw's dock at the top) measures them
// (docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"): the brand group at the left
// (`[data-toolbar-menu]`), the actions group at the right (`[data-toolbar-actions]`). The placement itself is
// line-centre's, shared with the bottom line.

export const BRAND_GROUP_SELECTOR = '[data-toolbar-menu]';
export const ACTIONS_GROUP_SELECTOR = '[data-toolbar-actions]';

/** The side groups on the page, for a hook to observe. */
export function topLineGroups(): HTMLElement[] {
  return [BRAND_GROUP_SELECTOR, ACTIONS_GROUP_SELECTOR]
    .map((s) => document.querySelector<HTMLElement>(s))
    .filter((el): el is HTMLElement => el !== null);
}

/** Where a centre toolbar `width` wide sits on the top line as drawn now, in the editor box `view`. */
export function measureTopLine(
  view: { left: number; width: number },
  width: number,
): CentrePlacement {
  const box = (s: string) =>
    document.querySelector<HTMLElement>(s)?.getBoundingClientRect() ?? null;
  return centreOnLine({
    view,
    start: box(BRAND_GROUP_SELECTOR),
    end: box(ACTIONS_GROUP_SELECTOR),
    width,
  });
}
