// Draw's dock on its line (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits"), by the centre toolbar rule
// (lib/line-centre).

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
  it('sits centred on the line while it fits centred', () => {
    const at = dockLinePlacement({
      view,
      start: box(12, 300),
      end: box(1000, 428),
      dockWidth: 400,
      lineHeight: 46,
      phone: false,
    });
    expect(at).toEqual({ ownRow: false, left: 520, room: 1000 - 8 - 320, edge: 12 });
  });

  it('slides off centre between the groups when centred would run under one', () => {
    const at = dockLinePlacement({
      view,
      start: box(12, 300),
      end: box(1000, 428),
      dockWidth: 600,
      lineHeight: 46,
      phone: false,
    });
    // Pressed against the document group\u2019s gap: 992 - 600.
    expect(at).toMatchObject({ ownRow: false, left: 392, edge: 12 });
  });

  it('takes a row of its own just inside the line when it does not fit between the groups', () => {
    const at = dockLinePlacement({
      view,
      start: box(12, 300),
      end: box(1000, 428),
      dockWidth: 673,
      lineHeight: 46,
      phone: false,
    });
    expect(at.ownRow).toBe(true);
    expect(at.edge).toBe(12 + 46 + 8);
  });

  it('always takes its own row on a phone, above a wrapped bottom line', () => {
    const at = dockLinePlacement({
      view: { left: 0, width: 390 },
      start: box(12, 200),
      end: box(12, 366),
      dockWidth: 200,
      lineHeight: 100,
      phone: true,
    });
    expect(at).toMatchObject({ ownRow: true, edge: 12 + 100 + 8 });
  });

  it('at the top, sits between the brand and actions groups the same way', () => {
    const at = dockLinePlacement({
      view,
      start: box(12, 230),
      end: box(1250, 178),
      dockWidth: 600,
      lineHeight: 46,
      phone: false,
    });
    expect(at).toMatchObject({ ownRow: false, left: 420, edge: 12 });
  });
});
