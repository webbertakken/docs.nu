import { describe, expect, it } from 'vitest';
import { brandLogoSvg } from './brand-logo-svg';
import {
  BRAND_MARK_VIEWBOX,
  BRAND_SHEETS,
  ISO_COS,
  SHEET,
  STACK_STEP,
  brandMarkSvg,
  sheetOffset,
  sheetTransform,
} from './brand-mark-geometry';
import { PRISM_PALETTES } from './brand-prism';

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

// docs/specs/004-interface-design/brand-mark.md "The mark": the Page Stack, three sheets back to front.
describe('the Page Stack', () => {
  it('stacks the sheet, the plain sheet and the page, back to front, each a step behind the next', () => {
    expect(BRAND_SHEETS.map((s) => [s.key, s.step])).toEqual([
      ['sheet', 2],
      ['plain', 1],
      ['page', 0],
    ]);
    expect(sheetOffset(0)).toEqual({ x: 0, y: 0 });
    expect(sheetOffset(1).x).toBeCloseTo(STACK_STEP.along * ISO_COS);
    expect(sheetOffset(1).y).toBeCloseTo(-(STACK_STEP.along / 2 + STACK_STEP.rise));
  });

  it('wears the brightest gradient in front and the deepest at the back', () => {
    expect(BRAND_SHEETS.map((s) => s.gradient)).toEqual(['sheet', 'plain', 'page']);
  });

  it('fits the closed stack inside its square viewBox', () => {
    const [x, y, w, h] = BRAND_MARK_VIEWBOX.split(' ').map(Number);
    expect(w).toBe(h);
    for (const { step } of BRAND_SHEETS) {
      const { x: ox, y: oy } = sheetOffset(step);
      const corners = [
        [0, 0],
        [SHEET.width, 0],
        [0, SHEET.height],
        [SHEET.width, SHEET.height],
      ].map(([u, v]) => [ISO_COS * u! + ox, 0.5 * u! + v! + oy]);
      for (const [cx, cy] of corners) {
        expect(cx).toBeGreaterThan(x!);
        expect(cx).toBeLessThan(x! + w!);
        expect(cy).toBeGreaterThan(y!);
        expect(cy).toBeLessThan(y! + h!);
      }
    }
  });

  // docs/specs/004-interface-design/brand-mark.md "Size and motion": the fan spreads the stack about its middle.
  it('fans the sheets apart about the plain sheet, which stays put', () => {
    expect(sheetOffset(1, 1)).toEqual(sheetOffset(1));
    expect(sheetOffset(0, 1).x).toBeCloseTo(-STACK_STEP.along * ISO_COS);
    expect(sheetOffset(2, 1).x).toBeCloseTo(3 * STACK_STEP.along * ISO_COS);
    expect(sheetTransform(0)).toBe(`matrix(${ISO_COS.toFixed(4)} 0.5 0 1 0 0)`);
  });
});

describe('brandMarkSvg', () => {
  it('draws the three sheets back to front, each in its isometric plane', () => {
    const svg = brandMarkSvg({ scheme: 'light' });
    let at = -1;
    for (const { step, gradient } of BRAND_SHEETS) {
      const next = svg.indexOf(`<g transform="${sheetTransform(step)}"><path d=`);
      expect(next, gradient).toBeGreaterThan(at);
      expect(svg.slice(next, next + 160)).toContain(`url(#${gradient})`);
      at = next;
    }
    expect(svg).toContain('isolation:isolate');
  });

  it('writes literal colours for a fixed scheme', () => {
    expect(brandMarkSvg({ scheme: 'light' })).toContain(
      `stop-color="${PRISM_PALETTES.light.vivid}"`,
    );
    const dark = brandMarkSvg({ scheme: 'dark' });
    expect(dark).toContain(`stop-color="${PRISM_PALETTES.dark.vivid}"`);
    expect(dark).toContain(`stroke="${PRISM_PALETTES.dark.highlight}"`);
    expect(dark).not.toContain('<style>');
  });

  it('follows prefers-color-scheme when auto, for favicons', () => {
    const svg = brandMarkSvg({ scheme: 'auto' });
    expect(svg).toContain(`.s-vivid{stop-color:${PRISM_PALETTES.light.vivid}}`);
    expect(svg).toContain(
      `@media (prefers-color-scheme:dark){.s-light{stop-color:${PRISM_PALETTES.dark.light}}`,
    );
    expect(svg).toContain(`.ink{stroke:${PRISM_PALETTES.dark.highlight}}`);
  });

  it('draws two bold lines in compact, and finer lines, grid cells and sheen in full', () => {
    const compact = brandMarkSvg({ variant: 'compact', scheme: 'light' });
    expect(count(compact, 'data-line')).toBe(2);
    expect(count(compact, '<rect')).toBe(0);
    expect(compact).not.toContain('sheen');
    const full = brandMarkSvg({ variant: 'full', scheme: 'light' });
    expect(count(full, 'data-line')).toBe(4);
    expect(count(full, '<rect')).toBe(3);
    expect(full).toContain('url(#sheen)');
  });

  // docs/specs/004-interface-design/brand-mark.md "Mono": one colour, the lines cut out.
  it('draws one colour in mono, each sheet at its opacity, with the lines cut out', () => {
    const svg = brandMarkSvg({ variant: 'full', tone: 'mono', colour: '#ffffff' });
    expect(svg).not.toContain('<linearGradient');
    for (const { monoOpacity } of BRAND_SHEETS) {
      expect(svg).toContain(`fill="#ffffff" opacity="${monoOpacity}"`);
    }
    expect(count(svg, '<mask')).toBe(2);
    expect(svg).toContain('stroke="#000000"');
  });

  it('prefixes every id and reference when asked', () => {
    for (const tone of ['colour', 'mono'] as const) {
      const svg = brandMarkSvg({ variant: 'full', scheme: 'light', tone, idPrefix: 'x-' });
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of [...ids, ...refs]) expect(id).toMatch(/^x-/);
      for (const ref of refs) expect(ids).toContain(ref);
    }
  });
});

describe('brandLogoSvg', () => {
  it('sets "Live" in the accent and "Doc" in ink, per scheme', () => {
    expect(brandLogoSvg('light')).toContain(
      '<tspan fill="#0284c7">Live</tspan><tspan fill="#0f172a">Doc</tspan>',
    );
    expect(brandLogoSvg('dark')).toContain(
      '<tspan fill="#38bdf8">Live</tspan><tspan fill="#f1f5f9">Doc</tspan>',
    );
  });

  it('nests the full mark with its own id prefix', () => {
    const svg = brandLogoSvg('light');
    expect(svg).toContain('url(#m-page)');
    expect(count(svg, 'xmlns=')).toBe(1);
  });
});
