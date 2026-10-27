import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { brandLogoSvg, brandMarkSvg } from '@livedoc/ui';

// Each frontend ships its own app/icon.svg, because Next's icon file
// convention wants one per app (and help's is served under its basePath), and
// marketing/media/logo/ holds the mark and lockup as files. All are written by
// `pnpm icons:brand` from the Page Stack module in @livedoc/ui. Nothing
// at runtime notices one of them drifting; this does.

const APPS = ['marketing', 'live', 'help', 'telemetry', 'community'] as const;
const REPO = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, REPO)), 'utf8').trim();
const REGENERATE = 'stale: run `pnpm icons:brand`';

describe('brand icon', () => {
  it('ships the compact, scheme-following mark as every app/icon.svg', () => {
    const favicon = brandMarkSvg({ variant: 'compact', scheme: 'auto' });
    for (const app of APPS)
      expect(read(`apps/${app}/app/icon.svg`), `${app} ${REGENERATE}`).toBe(favicon);
  });

  it('ships the full mark and the lockup, light and dark, in marketing/media/logo/', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(read(`marketing/media/logo/livedoc-mark-${scheme}.svg`), REGENERATE).toBe(
        brandMarkSvg({ variant: 'full', scheme }),
      );
      expect(read(`marketing/media/logo/livedoc-logo-${scheme}.svg`), REGENERATE).toBe(
        brandLogoSvg(scheme),
      );
    }
  });

  // The apps that serve their own icon under a basePath (help, community) pair the SVG with a PNG fallback through
  // Next's icon file convention (both app/icon.svg and app/icon.png), the 256px white tile the other three name in
  // BRAND_ICONS (docs/specs/016-platform/nextjs.md "Features used and declined").
  it('gives help and community the PNG fallback, the same tile marketing serves', () => {
    const tile = readFileSync(
      fileURLToPath(new URL('apps/marketing/public/livedoc-icon-256.png', REPO)),
    );
    for (const app of ['help', 'community'])
      expect(
        readFileSync(fileURLToPath(new URL(`apps/${app}/app/icon.png`, REPO))).equals(tile),
        `${app} ${REGENERATE}`,
      ).toBe(true);
  });

  // The api's emails load the mark from the site (docs/specs/014-identity/transactional-email.md "Branding"), so the
  // copy marketing serves for them must be the transparent 64px PNG the generator renders.
  it('serves the emails the transparent 64px mark', () => {
    const mark = readFileSync(
      fileURLToPath(new URL('marketing/media/icons/livedoc-icon-transparent-64.png', REPO)),
    );
    expect(
      readFileSync(
        fileURLToPath(new URL('apps/marketing/public/email/livedoc-mark-64.png', REPO)),
      ).equals(mark),
      REGENERATE,
    ).toBe(true);
  });
});

// A PNG's size, from its IHDR chunk.
const pngSize = (path: string) => {
  const png = readFileSync(fileURLToPath(new URL(path, REPO)));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

// docs/specs/004-interface-design/blueprints/brand-media.md: every raster the generator writes, at its size.
describe('brand media', () => {
  it('ships the mono press marks, black and white, from the module', () => {
    for (const colour of ['black', 'white'] as const)
      expect(read(`marketing/media/logo/livedoc-mark-mono-${colour}.svg`), REGENERATE).toBe(
        brandMarkSvg({
          variant: 'full',
          tone: 'mono',
          colour: colour === 'black' ? '#000000' : '#ffffff',
        }),
      );
  });

  it.each([
    ['apps/marketing/public/livedoc-icon-192.png', 192],
    ['apps/marketing/public/livedoc-icon-256.png', 256],
    ['apps/marketing/public/livedoc-icon-512.png', 512],
    ['apps/marketing/public/livedoc-maskable-192.png', 192],
    ['apps/marketing/public/livedoc-maskable-512.png', 512],
    ['apps/marketing/public/livedoc-monochrome-512.png', 512],
    ['apps/marketing/public/email/livedoc-mark-64.png', 64],
    ['marketing/media/icons/livedoc-icon-1024.png', 1024],
  ])('%s is %ipx square', (path, size) => {
    expect(pngSize(path), REGENERATE).toEqual({ width: size, height: size });
  });

  it('ships the lockup as 1200px-wide PNGs, light and dark', () => {
    for (const scheme of ['light', 'dark'])
      expect(pngSize(`marketing/media/logo/livedoc-logo-${scheme}.png`).width, REGENERATE).toBe(
        1200,
      );
  });

  // Browsers and tools ask for /favicon.ico by name; it holds 16, 32 and 48px images.
  it('ships favicon.ico with 16, 32 and 48px images', () => {
    const ico = readFileSync(fileURLToPath(new URL('apps/marketing/public/favicon.ico', REPO)));
    expect(ico.readUInt16LE(2), 'an icon file').toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes).toEqual([16, 32, 48]);
  });
});
