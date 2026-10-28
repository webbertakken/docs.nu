// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAppearance } from './appearance-store';
import { CHROME_SURFACE_ATTRIBUTE, CHROME_SURFACES, syncChromeColour } from './chrome-colour';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const steel = (token: string) =>
  source('../../../tailwind-config/theme.css').match(
    new RegExp(`\\.dark \\{[^}]*${token}: (#[0-9a-f]{6});`),
  )?.[1];
const metas = () => [
  ...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
];
const html = document.documentElement;
const PUBLIC_LAYOUTS = ['marketing', 'help', 'telemetry'].map((app) =>
  source(`../../../../apps/${app}/app/layout.tsx`),
);

afterEach(() => {
  html.className = '';
  html.removeAttribute('style');
  html.removeAttribute(CHROME_SURFACE_ATTRIBUTE);
  for (const m of metas()) m.remove();
});

// docs/specs/004-interface-design/appearance.md "The browser's chrome".
describe('the chrome surfaces', () => {
  it('header is the editor header and site footer: white, and Steel slate-900 in dark', () => {
    expect(CHROME_SURFACES.header).toMatchObject({
      light: '#ffffff',
      dark: steel('--color-slate-900'),
    });
    for (const surface of [
      source('../SiteFooter.tsx'),
      source('../../../../apps/live/components/chrome/EditorHeader.tsx'),
    ])
      expect(surface).toMatch(/bg-white[^"]*dark:bg-slate-900/);
  });

  it('ground is the public sites: slate-50, and Steel slate-950 in dark', () => {
    expect(CHROME_SURFACES.ground).toMatchObject({
      light: '#f8fafc',
      dark: steel('--color-slate-950'),
    });
    expect(source('../SiteHeader.tsx')).toMatch(/bg-slate-50\/80[^"]*dark:bg-slate-950\/80/);
    for (const layout of PUBLIC_LAYOUTS) {
      expect(layout).toMatch(/<html[^>]*data-chrome-surface="ground"/);
      expect(layout).toMatch(/<body[^>]*bg-slate-50[^"]*dark:bg-slate-950/);
    }
  });

  it('leaves the editor app on the header surface', () => {
    expect(source('../../../../apps/live/app/layout.tsx')).not.toContain(CHROME_SURFACE_ATTRIBUTE);
  });
});

describe('syncChromeColour', () => {
  it('paints the header white in light, adding the one theme-color meta', () => {
    syncChromeColour();
    expect(metas().map((m) => [m.content, m.hasAttribute('media')])).toEqual([['#ffffff', false]]);
  });

  it('paints the live dark surface, so a theme tint or Midnight carries to the title bar', () => {
    html.classList.add('dark');
    html.style.setProperty('--color-slate-900', '#1a2b3c');
    syncChromeColour();
    expect(metas().map((m) => m.content)).toEqual(['#1a2b3c']);
  });

  it('paints the ground on a page that declares it', () => {
    html.setAttribute(CHROME_SURFACE_ATTRIBUTE, 'ground');
    syncChromeColour();
    expect(metas().map((m) => m.content)).toEqual([CHROME_SURFACES.ground.light]);
    html.classList.add('dark');
    html.style.setProperty('--color-slate-950', '#070b1a');
    syncChromeColour();
    expect(metas().map((m) => m.content)).toEqual(['#070b1a']);
  });

  it('falls back to Steel when the dark token cannot be read', () => {
    html.classList.add('dark');
    syncChromeColour();
    expect(metas().map((m) => m.content)).toEqual([CHROME_SURFACES.header.dark]);
  });

  it('reuses the meta the boot script wrote', () => {
    syncChromeColour();
    html.classList.add('dark');
    syncChromeColour();
    expect(metas().map((m) => m.content)).toEqual([CHROME_SURFACES.header.dark]);
  });

  it('follows every appearance change', () => {
    applyAppearance('dark');
    expect(metas().map((m) => m.content)).toEqual([CHROME_SURFACES.header.dark]);
    applyAppearance('light');
    expect(metas().map((m) => m.content)).toEqual([CHROME_SURFACES.header.light]);
  });
});
