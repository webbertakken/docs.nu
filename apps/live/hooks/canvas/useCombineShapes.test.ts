import { describe, expect, it } from 'vitest';
import { layOutPages, type Element } from '@livedoc/document';
import { combinableSelection, withCombinedResult } from './useCombineShapes';

// docs/specs/007-editor/logo-pages.md "Combine": offered for two or more combinable, unlocked
// elements whose centres are all on one logo page.
describe('combinableSelection', () => {
  const pages = layOutPages([
    { id: 'l', orientation: 'portrait', size: 'logo', kind: 'logo' },
    { id: 'i', orientation: 'portrait' },
  ]);
  const sq = (id: string, x: number, extra: object = {}): Element => ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y: 0,
    width: 50,
    height: 50,
    ...extra,
  });
  const els = [sq('a', 0), sq('b', 20), sq('c', 2000), sq('d', 30, { locked: true })];

  it('gives the selection in stacking order on one logo page', () => {
    expect(combinableSelection(els, new Set(['b', 'a']), pages)?.map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('is null outside Pages, for one element, across pages, or with a locked one', () => {
    expect(combinableSelection(els, new Set(['a', 'b']), null)).toBeNull();
    expect(combinableSelection(els, new Set(['a']), pages)).toBeNull();
    expect(combinableSelection(els, new Set(['a', 'c']), pages)).toBeNull();
    expect(combinableSelection(els, new Set(['a', 'd']), pages)).toBeNull();
  });
});

// docs/specs/008-canvas/arrow-to-arrow.md: the inputs go, and with them the arrows attached to them and those hung
// off those arrows in turn.
describe('withCombinedResult', () => {
  const box = (id: string): Element => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
  });
  const result = { ...box('r'), type: 'path', d: 'M0 0' } as unknown as Element;

  it('puts the result where the bottom-most input sat, and takes the cascaded arrows', () => {
    const els: Element[] = [
      box('k'),
      box('a'),
      box('b'),
      {
        id: 'x',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'k', anchor: 'w' },
      },
      {
        id: 'y',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'on-arrow', arrowId: 'x', t: 0.5 },
      },
    ];
    const out = withCombinedResult(els, new Set(['a', 'b']), result);
    expect(out.map((el) => el.id)).toEqual(['k', 'r']);
  });
});
