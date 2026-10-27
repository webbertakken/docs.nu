import { BRAND_MARK_VIEWBOX, brandMarkSvg } from './brand-mark-geometry';
import type { PrismScheme } from './brand-prism';

// The horizontal lockup (mark + "LiveDoc" wordmark) as a standalone SVG,
// for marketing/media/logo/. The wordmark follows the spec's split: "Live" in
// the accent (brand-600 light, sky-400 dark), "Doc" in ink. It is set as
// live text in the system UI stack the apps use, so it renders in the viewer's
// font; outline it in a design tool before print use.
const WORDMARK = {
  light: { accent: '#0284c7', ink: '#0f172a' },
  dark: { accent: '#38bdf8', ink: '#f1f5f9' },
} as const;

// Lockup box: the 270-unit mark, a 24-unit gap, then the wordmark (about 480 units in the system UI stack), with
// the same room again after it.
const BRAND_LOGO_SIZE = { width: 800, height: 270 } as const;
const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function brandLogoSvg(scheme: PrismScheme): string {
  const mark = brandMarkSvg({ variant: 'full', scheme, idPrefix: 'm-' }).replace(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}"`,
    `<svg x="0" y="0" width="270" height="270" viewBox="${BRAND_MARK_VIEWBOX}"`,
  );
  const { accent, ink } = WORDMARK[scheme];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BRAND_LOGO_SIZE.width} ${BRAND_LOGO_SIZE.height}">` +
    mark +
    `<text x="294" y="178" font-family="${FONT_STACK}" font-size="128" font-weight="600" letter-spacing="-3">` +
    `<tspan fill="${accent}">Live</tspan><tspan fill="${ink}">Doc</tspan></text>` +
    `</svg>`
  );
}
