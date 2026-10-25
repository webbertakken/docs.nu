import { describe, expect, it } from 'vitest';
import { SLOT_ORDER, slotMarkers, withSlot } from '../../../scripts/pr-description.mjs';

// scripts/pr-description.mjs owns the slots below a pull request's description: sections that CI
// scripts fill and empty, in one fixed order at the very bottom, never touching what the author wrote.

const block = (name: string, content: string) => {
  const { start, end } = slotMarkers(name);
  return `${start}\n${content}\n${end}`;
};

describe('SLOT_ORDER', () => {
  it('puts the coverage report above the preview, which is last', () => {
    expect(SLOT_ORDER).toEqual(['coverage-report', 'preview']);
  });
});

describe('slotMarkers', () => {
  it('bounds a slot with HTML comments named after it', () => {
    expect(slotMarkers('preview')).toEqual({
      start: '<!-- livedoc:preview:start -->',
      end: '<!-- livedoc:preview:end -->',
    });
  });

  it('refuses a slot that has no place in the order', () => {
    expect(() => slotMarkers('stray')).toThrow(/stray/);
  });
});

describe('withSlot', () => {
  it('adds a slot below the description, leaving the description intact', () => {
    expect(withSlot('Fixes the thing.\n\n', 'preview', 'P1')).toBe(
      `Fixes the thing.\n\n${block('preview', 'P1')}`,
    );
  });

  it('is the slot alone for an empty description', () => {
    expect(withSlot(null, 'preview', 'P1')).toBe(block('preview', 'P1'));
    expect(withSlot('  \n', 'preview', 'P1')).toBe(block('preview', 'P1'));
  });

  it('replaces its own slot rather than adding a second', () => {
    const once = withSlot('Intro', 'preview', 'P1');
    expect(withSlot(once, 'preview', 'P2')).toBe(`Intro\n\n${block('preview', 'P2')}`);
  });

  it('is unchanged when the content is the same, so nothing is written', () => {
    const body = withSlot('Intro', 'coverage-report', 'R1');
    expect(withSlot(body, 'coverage-report', 'R1')).toBe(body);
  });

  it('keeps the slots in their order, whichever is written first', () => {
    const previewFirst = withSlot(withSlot('Intro', 'preview', 'P1'), 'coverage-report', 'R1');
    const coverageFirst = withSlot(withSlot('Intro', 'coverage-report', 'R1'), 'preview', 'P1');
    const expected = `Intro\n\n${block('coverage-report', 'R1')}\n\n${block('preview', 'P1')}`;
    expect(previewFirst).toBe(expected);
    expect(coverageFirst).toBe(expected);
  });

  it('moves the slots back to the bottom when the author wrote below them', () => {
    const body = `Intro\r\n\r\n${block('preview', 'P1')}\r\n\r\nAfterword`;
    expect(withSlot(body, 'preview', 'P2')).toBe(
      `Intro\r\n\r\nAfterword\n\n${block('preview', 'P2')}`,
    );
  });

  it('replaces to the end when the closing marker was edited away', () => {
    const { start } = slotMarkers('preview');
    expect(withSlot(`Intro\n\n${start}\nstale`, 'preview', 'P2')).toBe(
      `Intro\n\n${block('preview', 'P2')}`,
    );
  });

  it('empties a slot with null, leaving the rest as it was', () => {
    const both = withSlot(withSlot('Intro', 'coverage-report', 'R1'), 'preview', 'P1');
    expect(withSlot(both, 'preview', null)).toBe(`Intro\n\n${block('coverage-report', 'R1')}`);
    expect(withSlot(withSlot('Intro', 'preview', 'P1'), 'preview', null)).toBe('Intro');
    expect(withSlot('Intro', 'preview', null)).toBe('Intro');
  });
});
