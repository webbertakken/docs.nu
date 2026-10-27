import { useEffect, useRef } from 'react';
import { BRAND_SHEETS, sheetTransform } from './brand-mark-geometry';
import { BRAND_FAN_CLOSE_MS, BRAND_FAN_OPEN_MS, fanAt } from './brand-mark-motion';

// The sheet groups the fan moves, in BRAND_SHEETS order.
export type BrandFanTargets = (SVGGElement | null)[];

function paint(targets: BrandFanTargets, fan: number) {
  BRAND_SHEETS.forEach(({ step }, i) =>
    targets[i]?.setAttribute('transform', sheetTransform(step, fan)),
  );
}

// Fans the stack open while `active` and closes it after. Runs a frame loop only while moving, writes the sheets'
// transforms directly (no React render per frame), and does nothing at all under prefers-reduced-motion.
export function useBrandFan(active: boolean, targets: React.RefObject<BrandFanTargets>) {
  const state = useRef({ fan: 0, raf: 0 });

  useEffect(() => {
    const s = state.current;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cancelAnimationFrame(s.raf);
    const from = s.fan;
    const to = active ? 1 : 0;
    if (from === to) return;
    const duration = active ? BRAND_FAN_OPEN_MS : BRAND_FAN_CLOSE_MS;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / duration;
      s.fan = t >= 1 ? to : fanAt(from, to, t);
      if (targets.current) paint(targets.current, s.fan);
      if (t < 1) s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [active, targets]);
}
