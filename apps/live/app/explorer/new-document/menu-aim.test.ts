import { describe, expect, it } from 'vitest';
import { isHeadingTowards } from './menu-aim';

// The pane's right edge at x = 100, from y = 0 to y = 300; the list to its right.
const target = { top: { x: 100, y: 0 }, bottom: { x: 100, y: 300 } };

// docs/specs/013-workspace/new-document-menu.md "The menu": menu aim
describe('isHeadingTowards', () => {
  it('holds a move from a row down and left towards the pane', () => {
    expect(isHeadingTowards({ x: 200, y: 50 }, { x: 180, y: 70 }, target)).toBe(true);
  });

  it('holds a move up and left towards the pane', () => {
    expect(isHeadingTowards({ x: 200, y: 250 }, { x: 185, y: 230 }, target)).toBe(true);
  });

  it('lets a move straight down the list select', () => {
    expect(isHeadingTowards({ x: 200, y: 50 }, { x: 200, y: 80 }, target)).toBe(false);
  });

  it('lets a move away from the pane select', () => {
    expect(isHeadingTowards({ x: 200, y: 50 }, { x: 220, y: 60 }, target)).toBe(false);
  });

  it('reads a pointer that did not move as not heading', () => {
    expect(isHeadingTowards({ x: 200, y: 50 }, { x: 200, y: 50 }, target)).toBe(false);
  });
});
