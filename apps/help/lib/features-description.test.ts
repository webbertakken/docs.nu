import { describe, expect, it } from 'vitest';
import { metadata } from '../app/features/page';
import { featureCategories } from './articles';
import { FEATURES_DESCRIPTION_MAX, featuresDescription } from './features-description';

// docs/specs/018-help/help-app.md "SEO": the Features index's description is made from the catalogue.
describe('featuresDescription', () => {
  it('names every area in order, with a serial "and"', () => {
    expect(featuresDescription('LiveDoc', ['Canvas', 'Tabs', 'Tools'])).toBe(
      'Browse LiveDoc feature guides by area: Canvas, Tabs, and Tools.',
    );
    expect(featuresDescription('LiveDoc', ['Canvas', 'Tabs'])).toBe(
      'Browse LiveDoc feature guides by area: Canvas and Tabs.',
    );
    expect(featuresDescription('LiveDoc', ['Canvas'])).toBe(
      'Browse LiveDoc feature guides by area: Canvas.',
    );
    expect(featuresDescription('LiveDoc', [])).toBe('Browse LiveDoc feature guides by area.');
  });

  it('never runs past a search result, naming as many as fit', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Area Number ${i + 1}`);
    const text = featuresDescription('LiveDoc', many);
    expect(text.length).toBeLessThanOrEqual(FEATURES_DESCRIPTION_MAX);
    expect(text).toMatch(/^Browse LiveDoc feature guides by area: Area Number 1, .*, and more\.$/);
  });
});

describe('the Features index description', () => {
  const description = String(metadata.description ?? '');

  it('names every feature category, in order, and no other', () => {
    const areas = description.match(/feature guides by area: ([^.]+)\./)?.[1];
    expect(areas, 'the description lost its list of areas').toBeTruthy();
    const named = areas!.split(/,\s*(?:and\s+)?|\s+and\s+/);
    expect(named).toEqual(featureCategories.map((c) => c.title));
  });

  it('fits a search result', () => {
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(FEATURES_DESCRIPTION_MAX);
  });
});
