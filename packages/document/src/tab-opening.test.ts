import { describe, expect, it } from 'vitest';
import {
  TAB_OPENINGS,
  openingEditorMode,
  openingWorkshop,
  parseTabOpening,
  tabOpeningLabel,
  tabOpeningOf,
} from './tab-opening';

// docs/specs/007-editor/templates-by-mode.md "A template's mode": what a template, a blank or a document is made as.
describe('tab openings', () => {
  it('are Sketch, Structured, Pages, Workshop and Plan, in that order', () => {
    expect(TAB_OPENINGS).toEqual(['draw', 'diagram', 'pages', 'workshop', 'plan']);
    expect(TAB_OPENINGS.map(tabOpeningLabel)).toEqual([
      'Sketch',
      'Structured',
      'Pages',
      'Workshop',
      'Plan',
    ]);
  });

  it('read every stored name, old ones included', () => {
    expect(parseTabOpening('workshop')).toBe('workshop');
    expect(parseTabOpening('facilitate')).toBe('workshop');
    expect(parseTabOpening('illustrate')).toBe('pages');
    expect(parseTabOpening('infographic')).toBe('pages');
    expect(parseTabOpening('plan')).toBe('plan');
    expect(parseTabOpening('Workshop')).toBeUndefined();
    expect(parseTabOpening(3)).toBeUndefined();
  });

  it('open a Workshop in Structured with the control on, everything else in its own mode', () => {
    expect(openingEditorMode('workshop')).toBe('diagram');
    expect(openingWorkshop('workshop')).toBe(true);
    for (const o of ['draw', 'diagram', 'pages', 'plan'] as const) {
      expect(openingEditorMode(o)).toBe(o);
      expect(openingWorkshop(o)).toBe(false);
    }
  });

  it('say what a tab is made as: a Structured tab with the control on is a Workshop', () => {
    expect(tabOpeningOf({ workshop: true })).toBe('workshop');
    expect(tabOpeningOf({ opensIn: 'workshop' })).toBe('workshop');
    expect(tabOpeningOf({ opensIn: 'draw', workshop: true })).toBe('draw');
    expect(tabOpeningOf({ kind: 'board' })).toBe('plan');
    expect(tabOpeningOf({})).toBe('diagram');
  });
});
