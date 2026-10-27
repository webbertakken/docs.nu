// The logo's hover fan (docs/specs/004-interface-design/brand-mark.md "Size and motion"; its pace is listed in
// docs/specs/004-interface-design/motion.md beside the other hover stories). Pure, so the hook stays a thin loop.

// Opening while pointed at, and closing once the pointer leaves.
export const BRAND_FAN_OPEN_MS = 700;
export const BRAND_FAN_CLOSE_MS = 450;

export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

// How open the stack is `t` (0..1) of the way from `from` to `to`, easing out. A leave mid-open closes from where
// it is, not from fully open.
export const fanAt = (from: number, to: number, t: number) => from + (to - from) * easeOutCubic(t);
