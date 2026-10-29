import { describe, expect, it } from 'vitest';
import { TAB_OPENINGS } from '@livedoc/document';
import {
  POPULAR_BY_MODE,
  POPULAR_PER_MODE,
  POPULAR_TEMPLATE_KINDS,
  popularKindsFor,
} from './popular';
import { BLANK_TEMPLATE_FOR_OPENING, templateOpening } from './template-modes';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories": Popular is a curated list per mode filter.
describe('Popular', () => {
  const kinds = new Set(TEMPLATES.map((t) => t.kind));

  it('leads Everything with the five blanks, in the order of the openings', () => {
    expect(popularKindsFor('all')).toEqual([...POPULAR_TEMPLATE_KINDS]);
    expect(POPULAR_TEMPLATE_KINDS.slice(0, TAB_OPENINGS.length)).toEqual(
      TAB_OPENINGS.map((mode) => BLANK_TEMPLATE_FOR_OPENING[mode]),
    );
  });

  it('gives every mode a short list of its own, its blank first, each once, every kind real', () => {
    for (const [choice, list] of Object.entries(POPULAR_BY_MODE)) {
      expect(list.length, choice).toBeGreaterThanOrEqual(POPULAR_PER_MODE);
      expect(list.length, choice).toBeLessThanOrEqual(13);
      expect(new Set(list).size, choice).toBe(list.length);
      for (const k of list) expect(kinds.has(k), k).toBe(true);
      if (choice === 'all') continue;
      const mode = choice as keyof typeof BLANK_TEMPLATE_FOR_OPENING;
      expect(list[0], choice).toBe(BLANK_TEMPLATE_FOR_OPENING[mode]);
      for (const k of list) expect(templateOpening(k), k).toBe(mode);
    }
  });
});
