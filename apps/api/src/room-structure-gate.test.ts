import { describe, expect, it } from 'vitest';
import { presetSetup } from '@livedoc/items';
import {
  scopedTabOp,
  storedStructureOf,
  structureAgainst,
  structureFirst,
} from './room-structure-gate';

// The room's half of a tab-scoped Editor's limits (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"):
// what the gate answers from the op alone, and what it answers from the stored tab.

const board = { id: 'b1', type: 'shape', shape: 'plan-board', planBoard: presetSetup('kanban') };
const view = { id: 'v1', type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } };
const card = (itemId: string, id = 'c1') => ({
  id,
  type: 'shape',
  shape: 'plan-card',
  planCard: { itemId },
});
const sticky = { id: 's1', type: 'sticky', label: 'hi' };
const el = (op: unknown) => ({ kind: 'el', tabId: 't1', op });
const meta = (patch: unknown, clear?: string[]) => ({
  kind: 'tab-meta',
  tabId: 't1',
  patch,
  ...(clear ? { clear } : {}),
});
const destination = (tabId: string) => ({ destination: { tabId, typeId: 'task', status: 'todo' } });
const stored = storedStructureOf({
  name: 'Board',
  elements: [board, card('i1'), sticky],
  form: destination('t2'),
});

describe('storedStructureOf', () => {
  it('keeps the name, each Plan element by reach, and the form', () => {
    expect(stored.name).toBe('Board');
    expect([...stored.reach]).toEqual([
      ['b1', 'board'],
      ['c1', 'card:i1'],
    ]);
    expect(stored.form).toEqual(destination('t2'));
  });
});

describe('structureFirst', () => {
  it('drops an added board, plan view or Plan card from the op alone', () => {
    for (const element of [board, view, card('i9')])
      expect(structureFirst(el({ kind: 'add', element, at: 0 }), 't1')).toEqual({
        kind: 'drop',
        why: 'reach',
      });
  });

  it('asks the store about any other add, since an add of a stored id replaces that element', () => {
    expect(structureFirst(el({ kind: 'add', element: sticky, at: 0 }), 't1')).toEqual({
      kind: 'stored',
    });
  });

  it('asks the store about an update, a remove and a whole tab', () => {
    expect(structureFirst(el({ kind: 'update', element: sticky }), 't1')).toEqual({
      kind: 'stored',
    });
    expect(structureFirst(el({ kind: 'remove', id: 's1' }), 't1')).toEqual({ kind: 'stored' });
    expect(structureFirst({ kind: 'tab', tabId: 't1', tab: { id: 't1' } }, 't1')).toEqual({
      kind: 'stored',
    });
  });

  it('drops a patch touching what an element pulls in, and relays one that does not', () => {
    for (const set of [{ shape: 'plan-board' }, { planCard: { itemId: 'i2' } }, { planBoard: {} }])
      expect(structureFirst(el({ kind: 'patch', id: 's1', set }), 't1')).toEqual({
        kind: 'drop',
        why: 'reach',
      });
    expect(
      structureFirst(el({ kind: 'patch', id: 'c1', set: {}, clear: ['planCard'] }), 't1'),
    ).toEqual({ kind: 'drop', why: 'reach' });
    expect(structureFirst(el({ kind: 'patch', id: 's1', set: { x: 4 } }), 't1')).toEqual({
      kind: 'relay',
    });
  });

  it('relays a reorder, an el-delta and any op that is not about elements or the tab', () => {
    expect(structureFirst(el({ kind: 'reorder', ids: ['s1'] }), 't1')).toEqual({ kind: 'relay' });
    const delta = { kind: 'el-delta', tabId: 't1', elementId: 'b1', delta: { kind: 'board' } };
    expect(structureFirst(delta, 't1')).toEqual({ kind: 'relay' });
    expect(structureFirst({ kind: 'cursor', tabId: 't1', x: 1, y: 2 }, 't1')).toEqual({
      kind: 'relay',
    });
  });

  it('drops an element op it cannot read, rather than let it through unjudged', () => {
    for (const op of [{}, { kind: 'teleport' }, null, { kind: 'add', element: 'x' }])
      expect(structureFirst(el(op), 't1')).toEqual({ kind: 'drop', why: 'malformed' });
  });

  it('relays a form kept on its tab, asks about one pointed elsewhere, relays other patches', () => {
    expect(structureFirst(meta({ form: destination('t1') }), 't1')).toEqual({ kind: 'relay' });
    expect(structureFirst(meta({ form: destination('t2') }), 't1')).toEqual({ kind: 'stored' });
    expect(structureFirst(meta({ theme: 'x' }), 't1')).toEqual({ kind: 'relay' });
    expect(structureFirst(meta({}, ['form']), 't1')).toEqual({ kind: 'relay' });
  });
});

describe('structureAgainst', () => {
  const relays = (op: unknown) => ({ kind: 'relay', op, renamed: false });

  it('relays a board or Plan card moved or restyled, never one changing what it pulls in', () => {
    const moved = el({ kind: 'update', element: { ...board, x: 9 } });
    expect(structureAgainst(moved, stored, 't1')).toEqual(relays(moved));
    const same = el({ kind: 'update', element: { ...card('i1'), fillColor: '#fff' } });
    expect(structureAgainst(same, stored, 't1')).toEqual(relays(same));
    for (const element of [card('i2'), { ...board, id: 's1' }, { ...sticky, id: 'b1' }])
      expect(structureAgainst(el({ kind: 'update', element }), stored, 't1')).toEqual({
        kind: 'drop',
        why: 'reach',
      });
  });

  it('drops an add that would replace a stored Plan element, relays any other', () => {
    expect(
      structureAgainst(el({ kind: 'add', element: { ...sticky, id: 'b1' }, at: 0 }), stored, 't1'),
    ).toEqual({ kind: 'drop', why: 'reach' });
    const fresh = el({ kind: 'add', element: { ...sticky, id: 'n1' }, at: 0 });
    expect(structureAgainst(fresh, stored, 't1')).toEqual(relays(fresh));
  });

  it('drops removing a board or Plan card, relays removing anything else', () => {
    for (const id of ['b1', 'c1'])
      expect(structureAgainst(el({ kind: 'remove', id }), stored, 't1')).toEqual({
        kind: 'drop',
        why: 'reach',
      });
    const gone = el({ kind: 'remove', id: 's1' });
    expect(structureAgainst(gone, stored, 't1')).toEqual(relays(gone));
  });

  it('judges a form patch against the stored form', () => {
    // The owner's destination on another tab, kept while a question changes.
    const kept = meta({ form: { heading: 'New', ...destination('t2') } });
    expect(structureAgainst(kept, stored, 't1')).toEqual(relays(kept));
    expect(structureAgainst(meta({ form: destination('t3') }), stored, 't1')).toEqual({
      kind: 'drop',
      why: 'form',
    });
  });

  it('relays a whole tab that keeps its reach and form, under the stored name', () => {
    const tab = (over: object) => ({
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't1', name: 'Board', elements: [board, card('i1'), sticky], ...over },
    });
    expect(structureAgainst(tab({}), stored, 't1')).toEqual(relays(tab({})));
    expect(structureAgainst(tab({ name: 'Mine' }), stored, 't1')).toEqual({
      kind: 'relay',
      op: tab({ name: 'Board' }),
      renamed: true,
    });
    expect(
      structureAgainst(tab({ elements: [board, card('i1'), sticky, view] }), stored, 't1'),
    ).toEqual({ kind: 'drop', why: 'reach' });
    expect(structureAgainst(tab({ elements: [sticky] }), stored, 't1')).toEqual({
      kind: 'drop',
      why: 'reach',
    });
    expect(structureAgainst(tab({ form: destination('t3') }), stored, 't1')).toEqual({
      kind: 'drop',
      why: 'form',
    });
  });
});

describe('scopedTabOp', () => {
  it('stamps the stored name on a whole-tab op and leaves any other op as sent', () => {
    const op = { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'Mine' } };
    expect(scopedTabOp(op, 'Board')).toEqual({
      kind: 'tab',
      tabId: 't1',
      tab: { id: 't1', name: 'Board' },
    });
    const other = el({ kind: 'remove', id: 's1' });
    expect(scopedTabOp(other, 'Board')).toBe(other);
  });
});
