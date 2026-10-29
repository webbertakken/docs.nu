import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedoc/document';
import { newTabOpening, newTabSeed } from './new-tab-seed';

// docs/specs/007-editor/editor-modes.md "+ adds a tab or a Plan tab": the add menu's Tab opens in the mode it was made
// from; Board, Sheet and Dashboard open a Plan start.
describe('newTabOpening', () => {
  const tab = (over: Partial<Tab> = {}): Tab => ({ id: 's', name: 'S', elements: [], ...over });

  it('opens a Tab added from Sketch or Pages in that mode', () => {
    for (const mode of ['draw', 'pages'] as const)
      expect(newTabOpening(tab({ opensIn: mode }), 'tab')).toEqual({ opensIn: mode });
  });

  it('opens a Tab added from Structured, an event-storming board or a Plan tab in Structured, writing no mode', () => {
    expect(newTabOpening(tab(), 'tab')).toEqual({});
    expect(newTabOpening(tab({ kind: 'event-storming' }), 'tab')).toEqual({});
    expect(newTabOpening(tab({ kind: 'board' }), 'tab')).toEqual({});
    expect(newTabOpening(tab({ opensIn: 'plan' }), 'tab')).toEqual({});
    expect(newTabOpening(undefined, 'tab')).toEqual({});
  });

  it('opens a Board, Sheet or Dashboard as a Plan start, whatever it was made from', () => {
    for (const choice of ['board', 'sheet', 'dashboard'] as const) {
      expect(newTabOpening(tab({ opensIn: 'draw' }), choice)).toEqual({ opensIn: 'plan' });
      expect(newTabOpening(tab({ kind: 'sheet' }), choice)).toEqual({ opensIn: 'plan' });
    }
  });
});

const source: Tab = {
  id: 's',
  name: 'Source',
  elements: [],
  theme: 'slate',
  backgroundPattern: 'grid',
  backgroundColor: '#fdf2f8',
  backgroundOpacity: 0.8,
  patternColor: '#fbcfe8',
  font: 'caveat',
};

// A tab added from the tab bar carries the look of the tab it was added from.
describe('newTabSeed', () => {
  it('carries the source tab’s theme, canvas and type', () => {
    expect(newTabSeed(source)).toEqual({
      theme: 'slate',
      backgroundPattern: 'grid',
      backgroundColor: '#fdf2f8',
      backgroundOpacity: 0.8,
      patternColor: '#fbcfe8',
      font: 'caveat',
      defaultTextSize: 'sm',
    });
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": the look is the seed's, the mode
  // newTabOpening's (the creator's mode), never the source's stored field.
  it('never carries an opening mode, even from a tab that opens in Draw', () => {
    expect(newTabSeed({ ...source, opensIn: 'draw' }).opensIn).toBeUndefined();
  });

  it('falls back to defaults with no source tab', () => {
    expect(newTabSeed(undefined)).toEqual({});
  });
});
