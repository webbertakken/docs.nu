import { describe, expect, it } from 'vitest';
import { mixHex } from './color-wash';
import { liftAccent } from './plan-palette';

// docs/specs/011-theme/light-and-dark.md "Colours an agent writes": a shorthand or named colour mixes as its hex.
describe('mixHex', () => {
  it('mixes two six-digit hexes', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('reads a shorthand or named colour as its hex', () => {
    expect(mixHex('#fff', 'black', 0.5)).toBe('#808080');
    expect(mixHex('red', '#000000', 1)).toBe('#ff0000');
  });

  it('gives back the first when either is unreadable', () => {
    expect(mixHex('#123456', 'nope', 0.5)).toBe('#123456');
  });
});

describe('liftAccent', () => {
  it('lifts a named accent as its hex, never straight to white', () => {
    expect(liftAccent('navy')).not.toBe('#ffffff');
    expect(liftAccent('navy')).toBe(liftAccent('#000080'));
  });
});
