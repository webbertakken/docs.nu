import { describe, expect, it } from 'vitest';
import { allowedTypos, typoDistance } from './typo-distance';

const distance = (word: string, target: string, limit: number) =>
  typoDistance(word, target, 0, target.length, limit);

describe('allowedTypos', () => {
  it.each([
    [3, 0],
    [4, 1],
    [7, 1],
    [8, 2],
    [20, 2],
  ])('gives a word of %i letters %i typos', (length, typos) => {
    expect(allowedTypos(length)).toBe(typos);
  });
});

describe('typoDistance', () => {
  it('counts nothing for the word itself', () => {
    expect(distance('notes', 'notes', 1)).toEqual({ distance: 0, length: 5 });
  });

  it.each([
    ['substitution', 'nates'],
    ['insertion', 'nottes'],
    ['deletion', 'ntes'],
    ['transposition', 'ntoes'],
  ])('counts one %s as one typo', (_, word) => {
    expect(distance(word, 'notes', 1)?.distance).toBe(1);
  });

  it('measures against the closest start of the target', () => {
    expect(distance('retro', 'retrospective', 1)).toEqual({ distance: 0, length: 5 });
    expect(distance('retrp', 'retrospective', 1)).toEqual({ distance: 1, length: 5 });
    expect(distance('retrsp', 'retrospective', 1)).toEqual({ distance: 1, length: 7 });
  });

  it('reads a word inside a longer text by its offsets', () => {
    expect(typoDistance('notse', 'Meeting notes', 8, 13, 1)).toEqual({ distance: 1, length: 5 });
  });

  it('gives up past the limit', () => {
    expect(distance('nitas', 'notes', 1)).toBeNull();
    expect(distance('nitas', 'notes', 2)?.distance).toBe(2);
  });

  it('gives up on a target too short to hold the word', () => {
    expect(distance('planning', 'plan', 2)).toBeNull();
  });
});
