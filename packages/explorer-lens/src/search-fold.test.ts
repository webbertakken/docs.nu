import { describe, expect, it } from 'vitest';
import { foldSearchText, searchQueryWords } from './search-fold';

describe('foldSearchText', () => {
  it('folds case and accents and keeps one space between words', () => {
    expect(foldSearchText('  Café — Q3-plan,\n\tRésumé!! ')).toBe('cafe q3 plan resume');
  });

  it('answers nothing for text with no letter or digit', () => {
    expect(foldSearchText(' — !? ')).toBe('');
  });
});

describe('searchQueryWords', () => {
  it('splits a query as names are split', () => {
    expect(searchQueryWords('Rétro q3-PLAN')).toEqual(['retro', 'q3', 'plan']);
  });
});
