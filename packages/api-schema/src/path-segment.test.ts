import { describe, expect, it } from 'vitest';
import { decodePathSegment } from './path-segment';

describe('decodePathSegment', () => {
  it('decodes a raw or percent-encoded segment', () => {
    expect(decodePathSegment('mode%3Adraw')).toBe('mode:draw');
    expect(decodePathSegment('plain')).toBe('plain');
  });

  it('answers null for a malformed escape, never throwing', () => {
    expect(decodePathSegment('%')).toBeNull();
    expect(decodePathSegment('%E0%A4%A')).toBeNull();
  });
});
