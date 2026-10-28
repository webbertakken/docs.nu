// A line's centre toolbar (docs/specs/007-editor/toolbar-layout.md "When a line runs out of room"): centred while it
// fits centred, else between the side groups off centre, else it does not fit (tiles drop, or its own row).

import { describe, expect, it } from 'vitest';
import { LINE_GAP_PX, LINE_INSET_PX, centreOnLine } from './line-centre';

const view = { left: 0, width: 1440 };
const box = (left: number, width: number) => ({ left, right: left + width, width });
// The brand group 12..242 (230 wide), the actions group ending 12 from the right.
const start = box(12, 230);
const end = (width: number) => box(1440 - 12 - width, width);

describe('centreOnLine', () => {
  it('centres the toolbar while it clears both groups by the gap', () => {
    const at = centreOnLine({ view, start, end: end(300), width: 600 });
    expect(at).toEqual({
      room: 1428 - 300 - 242 - 2 * LINE_GAP_PX,
      left: 420,
      fits: true,
      centred: true,
    });
  });

  it('is still centred exactly at the gap on the wider side', () => {
    // Centred, the toolbar’s right edge meets the actions group less the gap.
    const widest = 2 * (1428 - 300 - LINE_GAP_PX - 720);
    const at = centreOnLine({ view, start, end: end(300), width: widest });
    expect(at.centred).toBe(true);
    expect(at.left + widest).toBe(1428 - 300 - LINE_GAP_PX);
  });

  it('slides off centre, toward the narrower group, one pixel past centred', () => {
    const widest = 2 * (1428 - 300 - LINE_GAP_PX - 720);
    const at = centreOnLine({ view, start, end: end(300), width: widest + 2 });
    expect(at.fits).toBe(true);
    expect(at.centred).toBe(false);
    // Pressed against the actions group’s gap.
    expect(at.left + widest + 2).toBe(1428 - 300 - LINE_GAP_PX);
  });

  it('fits between the groups up to the room exactly, then does not', () => {
    const room = 1428 - 300 - LINE_GAP_PX - (242 + LINE_GAP_PX);
    const just = centreOnLine({ view, start, end: end(300), width: room });
    expect(just).toMatchObject({ fits: true, left: 242 + LINE_GAP_PX });
    const over = centreOnLine({ view, start, end: end(300), width: room + 1 });
    expect(over).toMatchObject({ fits: false, centred: false, room });
  });

  it('measures in the editor box (a split pane) and reports left from its edge', () => {
    const pane = { left: 720, width: 720 };
    const at = centreOnLine({ view: pane, start: box(732, 150), end: box(1240, 188), width: 300 });
    expect(at).toMatchObject({ fits: true, centred: true, left: 210 });
  });

  it('takes the line’s inset where a group is not drawn', () => {
    const at = centreOnLine({ view, start: null, end: null, width: 1440 - 2 * LINE_INSET_PX });
    expect(at).toMatchObject({ fits: true, centred: true, left: LINE_INSET_PX });
    expect(centreOnLine({ view, start: box(0, 0), end: null, width: 100 }).room).toBe(
      1440 - 2 * LINE_INSET_PX,
    );
  });
});
