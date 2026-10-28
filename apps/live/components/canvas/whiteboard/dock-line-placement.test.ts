// Draw's dock on its line (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits").

import { describe, expect, it } from 'vitest';
import { dockLinePlacement } from './dock-line-placement';

const view = { left: 0, width: 1440 };
const box = (left: number, width: number, height = 46) => ({
  left,
  right: left + width,
  width,
  height,
});

describe('dockLinePlacement', () => {
  it('sits on the line, centred clear of the wider side group, when it fits', () => {
    const at = dockLinePlacement({
      position: 'bottom',
      view,
      start: box(12, 300),
      end: box(1000, 428),
      dockWidth: 400,
      lineHeight: 46,
      phone: false,
    });
    expect(at).toEqual({ clear: 448, ownRow: false, edge: 12 });
  });

  it('takes a row of its own just inside the line when it does not fit between the groups', () => {
    const at = dockLinePlacement({
      position: 'bottom',
      view,
      start: box(12, 300),
      end: box(1000, 428),
      dockWidth: 700,
      lineHeight: 46,
      phone: false,
    });
    expect(at.ownRow).toBe(true);
    expect(at.edge).toBe(12 + 46 + 8);
  });

  it('always takes its own row on a phone, above a wrapped bottom line', () => {
    const at = dockLinePlacement({
      position: 'bottom',
      view: { left: 0, width: 390 },
      start: box(12, 200),
      end: box(12, 366),
      dockWidth: 200,
      lineHeight: 100,
      phone: true,
    });
    expect(at).toMatchObject({ ownRow: true, edge: 12 + 100 + 8 });
  });

  it('at the top, clears the brand and actions groups the same way', () => {
    const at = dockLinePlacement({
      position: 'top',
      view,
      start: box(12, 230),
      end: box(1250, 178),
      dockWidth: 600,
      lineHeight: 46,
      phone: false,
    });
    expect(at).toEqual({ clear: 250, ownRow: false, edge: 12 });
  });
});
