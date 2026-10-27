import { describe, expect, it } from 'vitest';
import {
  TITLE_CACHE_LIMIT,
  foldText,
  foldedTitle,
  foldedTitleCount,
  letterBit,
} from './title-fold';

describe('foldText', () => {
  it('folds case and accents', () => {
    expect(foldText('Ångström ÉTÉ')).toBe('angstrom ete');
  });
});

describe('letterBit', () => {
  it('gives each of a to z its own bit and shares six among the rest', () => {
    expect(letterBit('a'.charCodeAt(0))).toBe(1);
    expect(letterBit('z'.charCodeAt(0))).toBe(1 << 25);
    expect(letterBit('0'.charCodeAt(0))).toBe(1 << (26 + (48 % 6)));
  });
});

describe('foldedTitle', () => {
  it('folds an ASCII title in place, with its words', () => {
    expect(foldedTitle('Q3 - Plan')).toEqual({
      folded: 'q3 - plan',
      wordStarts: [0, 5],
      wordEnds: [2, 9],
      wordLetters: [
        letterBit(113) | letterBit(51),
        [...'plan'].reduce((b, c) => b | letterBit(c.charCodeAt(0)), 0),
      ],
      origin: null,
      length: 9,
    });
  });

  it('records where each folded character came from', () => {
    const title = foldedTitle('Ne\u0301 🚀 x');
    expect(title.folded).toBe('ne 🚀 x');
    expect(title.origin).toEqual([0, 1, 3, 4, 4, 6, 7]);
  });

  it('folds a title with no combining marks of its own in place, accents and all', () => {
    expect(foldedTitle('Né 🚀').origin).toBeNull();
  });

  it('folds a title once', () => {
    const first = foldedTitle('Folded once');
    expect(foldedTitle('Folded once')).toBe(first);
  });

  it('starts the cache over when it is full', () => {
    for (let i = foldedTitleCount(); i < TITLE_CACHE_LIMIT; i++) foldedTitle(`title ${i}`);
    expect(foldedTitleCount()).toBe(TITLE_CACHE_LIMIT);
    foldedTitle('one more');
    expect(foldedTitleCount()).toBe(1);
  });
});
