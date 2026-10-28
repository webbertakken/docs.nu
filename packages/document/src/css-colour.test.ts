import { describe, expect, it } from 'vitest';
import { cssColourNames, parseCssColour, parseCssColourAlpha } from './css-colour';

// docs/specs/011-theme/light-and-dark.md "Colours an agent writes".
describe('parseCssColour', () => {
  it('reads every hex form, the # optional only on the long two', () => {
    expect(parseCssColour('#0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseCssColour('0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseCssColour('#0ea5e980')).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseCssColour('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColour('#fff8')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColour(' #0A5 ')).toEqual({ r: 0, g: 170, b: 85 });
    expect(parseCssColour('fff')).toBeNull();
  });

  it('reads every CSS named colour, any case', () => {
    expect(cssColourNames()).toHaveLength(148);
    expect(parseCssColour('RebeccaPurple')).toEqual({ r: 102, g: 51, b: 153 });
    for (const name of cssColourNames()) expect(parseCssColour(name)).not.toBeNull();
  });

  it('is null for what CSS reads but a solid colour sum cannot', () => {
    for (const bad of ['transparent', 'currentColor', 'rgb(0,0,0)', 'hsl(0 0% 0%)', '', '#', '#ff'])
      expect(parseCssColour(bad)).toBeNull();
  });
});

describe('parseCssColourAlpha', () => {
  it('keeps the alpha, 255 when the colour gives none', () => {
    expect(parseCssColourAlpha('#fff8')?.a).toBe(136);
    expect(parseCssColourAlpha('#0ea5e980')?.a).toBe(128);
    expect(parseCssColourAlpha('#0ea5e9')?.a).toBe(255);
    expect(parseCssColourAlpha('red')?.a).toBe(255);
    expect(parseCssColourAlpha('nope')).toBeNull();
  });
});
