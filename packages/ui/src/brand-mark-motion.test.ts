import { describe, expect, it } from 'vitest';
import { BRAND_FAN_CLOSE_MS, BRAND_FAN_OPEN_MS, easeOutCubic, fanAt } from './brand-mark-motion';

// docs/specs/004-interface-design/brand-mark.md "Size and motion": the hover fan.
describe('the hover fan', () => {
  it('opens over 700ms and closes over 450ms', () => {
    expect(BRAND_FAN_OPEN_MS).toBe(700);
    expect(BRAND_FAN_CLOSE_MS).toBe(450);
  });

  it('eases out from where it is to where it goes', () => {
    expect(fanAt(0, 1, 0)).toBe(0);
    expect(fanAt(0, 1, 1)).toBe(1);
    expect(fanAt(0, 1, 0.5)).toBeCloseTo(easeOutCubic(0.5));
    // Leaving half-open closes from there, not from fully open.
    expect(fanAt(0.4, 0, 0)).toBe(0.4);
    expect(fanAt(0.4, 0, 1)).toBe(0);
  });

  it('clamps time outside 0..1', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});
