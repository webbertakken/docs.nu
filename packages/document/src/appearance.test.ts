import { describe, expect, it } from 'vitest';
import { APPEARANCES, isAppearance } from './themes';

// The two appearances a viewer can be in (docs/specs/011-theme/light-and-dark.md), as read from outside.
describe('isAppearance', () => {
  it('names light and dark, and nothing else', () => {
    for (const a of APPEARANCES) expect(isAppearance(a)).toBe(true);
    for (const other of ['system', 'Dark', '', null, undefined, 1])
      expect(isAppearance(other)).toBe(false);
  });
});
