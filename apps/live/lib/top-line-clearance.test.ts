// The strip's clearance from both of the top line's side groups (docs/specs/007-editor/toolbar-layout.md "When a line
// runs out of room").

import { describe, expect, it } from 'vitest';
import { TOP_LINE_GAP_PX, topLineClearance } from './top-line-clearance';

const view = { left: 0, right: 1440, width: 1440 };
const box = (left: number, right: number) => ({ left, right, width: right - left });

describe('topLineClearance', () => {
  it('keeps clear of the wider side group, plus the gap', () => {
    expect(topLineClearance(view, box(12, 230), box(1120, 1428))).toBe(320 + TOP_LINE_GAP_PX);
    expect(topLineClearance(view, box(12, 400), box(1300, 1428))).toBe(400 + TOP_LINE_GAP_PX);
  });

  it('measures from the editor box, not the window (a split pane)', () => {
    const pane = { left: 720, right: 1440, width: 720 };
    expect(topLineClearance(pane, box(732, 950), box(1200, 1428))).toBe(240 + TOP_LINE_GAP_PX);
  });

  it('takes nothing for a group that is not drawn or is hidden', () => {
    expect(topLineClearance(view, box(12, 230), null)).toBe(230 + TOP_LINE_GAP_PX);
    expect(topLineClearance(view, null, box(0, 0))).toBe(0);
    expect(topLineClearance(view, null, null)).toBe(0);
  });
});
