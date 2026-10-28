// The browser's own chrome (an installed app's title bar, a phone's status bar) wears the colour at the top of the
// page (docs/specs/004-interface-design/appearance.md "The browser's chrome"), so the window reads as one piece. One
// `<meta name="theme-color">`, written before first paint by the appearance script and kept current here; never set
// through Next's viewport, so React owns no copy of it to put back.
//
// Deliberately NOT a `'use client'` module: the appearance store imports it, and that store sits in the server
// layout's import chain (see appearance-storage).

/**
 * The two surfaces a page's top can be. `header`: the editor's header and the site footer (`bg-white`,
 * `dark:bg-slate-900`). `ground`: the public sites' page ground, which their translucent header shows (`bg-slate-50`,
 * `dark:bg-slate-950`). Light is fixed; dark reads its token as painted, since a themed tab or Midnight retargets it,
 * with Steel's value (theme.css) as the fallback.
 */
export const CHROME_SURFACES = {
  header: { light: '#ffffff', dark: '#131b26', darkToken: '--color-slate-900' },
  ground: { light: '#f8fafc', dark: '#0b0f16', darkToken: '--color-slate-950' },
} as const;

export type ChromeSurface = keyof typeof CHROME_SURFACES;

/** Set on `<html>` by a layout whose top is the page ground; absent means `header`. */
export const CHROME_SURFACE_ATTRIBUTE = 'data-chrome-surface';

function surfaceOf(html: HTMLElement): (typeof CHROME_SURFACES)[ChromeSurface] {
  return html.getAttribute(CHROME_SURFACE_ATTRIBUTE) === 'ground'
    ? CHROME_SURFACES.ground
    : CHROME_SURFACES.header;
}

function chromeColour(html: HTMLElement): string {
  const surface = surfaceOf(html);
  if (!html.classList.contains('dark')) return surface.light;
  const live = getComputedStyle(html).getPropertyValue(surface.darkToken).trim();
  return live || surface.dark;
}

/** Points the theme-color meta at the page's top as painted now. Call after anything that changes it. */
export function syncChromeColour(): void {
  if (typeof document === 'undefined') return;
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = chromeColour(document.documentElement);
}
