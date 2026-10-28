import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetSetup } from '@livedoc/items';
import { migrateDocumentSchema } from './document-room/document-schema';
import { RoomScopedStructure, SCOPED_TABS_CACHED, type TabStore } from './room-scoped-structure';
import { roomSqlStorage } from './test-document-room';

// A tab-scoped session's ops in the room (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"): judged
// against the tab as the room's own SQLite stores it, parsed again only when that tab was written.

const board = { id: 'b1', type: 'shape', shape: 'plan-board', planBoard: presetSetup('kanban') };
const sticky = { id: 's1', type: 'sticky', label: 'hi' };
const el = (op: unknown) => ({ kind: 'el', tabId: 't1', op });
const where = { documentId: 'd1', tabId: 't1' };

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function storeWith(tabs: { id: string; name: string; elements: object[] }[]): TabStore {
  const sql = roomSqlStorage().sql as unknown as TabStore;
  migrateDocumentSchema((q) => sql.exec(q));
  for (const t of tabs)
    sql.exec(
      'INSERT INTO tabs (id, name, data, updated_at, rev) VALUES (?, ?, ?, 1, 1)',
      t.id,
      t.name,
      JSON.stringify({ elements: t.elements }),
    );
  return sql;
}

describe('RoomScopedStructure', () => {
  it('drops an op changing the stored reach and relays one keeping it', () => {
    const scoped = new RoomScopedStructure(() =>
      storeWith([{ id: 't1', name: 'Board', elements: [board, sticky] }]),
    );
    expect(scoped.admit(el({ kind: 'remove', id: 'b1' }), where)).toBeNull();
    expect(info).toHaveBeenCalledWith('[room] scoped structure dropped', {
      ...where,
      kind: 'el',
      why: 'reach',
    });
    const moved = el({ kind: 'update', element: { ...board, x: 9 } });
    expect(scoped.admit(moved, where)).toEqual({ op: moved });
  });

  it('sends a whole tab out under the stored name, and logs it', () => {
    const scoped = new RoomScopedStructure(() =>
      storeWith([{ id: 't1', name: 'Board', elements: [board, sticky] }]),
    );
    const tab = { id: 't1', name: 'Mine', elements: [board, sticky] };
    expect(scoped.admit({ kind: 'tab', tabId: 't1', tab }, where)).toEqual({
      op: { kind: 'tab', tabId: 't1', tab: { ...tab, name: 'Board' } },
    });
    expect(info).toHaveBeenCalledWith('[room] scoped tab op renamed back', where);
  });

  it('lets an op needing the store pass, logged, where the room stores no such tab', () => {
    const removal = el({ kind: 'remove', id: 'b1' });
    for (const store of [() => null, () => storeWith([])]) {
      expect(new RoomScopedStructure(store).admit(removal, where)).toEqual({ op: removal });
    }
    expect(info).toHaveBeenCalledWith('[room] scoped structure unjudged', { ...where, kind: 'el' });
    // What the op alone decides holds without a store.
    const card = { id: 'c9', type: 'shape', shape: 'plan-card', planCard: { itemId: 'i9' } };
    expect(
      new RoomScopedStructure(() => null).admit(el({ kind: 'add', element: card, at: 0 }), where),
    ).toBeNull();
  });

  it('never reads the store for an op it judges alone', () => {
    const store = vi.fn(() => null);
    const scoped = new RoomScopedStructure(store);
    const reorder = el({ kind: 'reorder', ids: [] });
    expect(scoped.admit(reorder, where)).toEqual({ op: reorder });
    expect(scoped.admit({ kind: 'cursor', tabId: 't1', x: 1, y: 1 }, where)).not.toBeNull();
    expect(store).not.toHaveBeenCalled();
  });

  it('fails closed, and says so, when the store cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scoped = new RoomScopedStructure(() => ({
      exec: () => {
        throw new Error('SQLITE_BUSY');
      },
    }));
    expect(scoped.admit(el({ kind: 'remove', id: 's1' }), where)).toBeNull();
    expect(warn).toHaveBeenCalledWith('[room] scoped check failed', {
      ...where,
      kind: 'el',
      error: 'Error: SQLITE_BUSY',
    });
  });

  it('parses the stored tab again only once it was written', () => {
    const sql = storeWith([{ id: 't1', name: 'Board', elements: [board, sticky] }]);
    const exec = vi.spyOn(sql, 'exec');
    const parses = () => exec.mock.calls.filter(([q]) => q.startsWith('SELECT name, data')).length;
    const scoped = new RoomScopedStructure(() => sql);
    const removal = el({ kind: 'remove', id: 'b1' });
    expect(scoped.admit(removal, where)).toBeNull();
    expect(scoped.admit(removal, where)).toBeNull();
    expect(parses()).toBe(1);
    sql.exec(
      'UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?',
      JSON.stringify({ elements: [sticky] }),
      't1',
    );
    expect(scoped.admit(removal, where)).toEqual({ op: removal });
    expect(parses()).toBe(2);
  });

  it(`keeps at most ${SCOPED_TABS_CACHED} tabs parsed`, () => {
    const ids = Array.from({ length: SCOPED_TABS_CACHED + 1 }, (_, i) => `t${i + 1}`);
    const sql = storeWith(ids.map((id) => ({ id, name: id, elements: [board] })));
    const exec = vi.spyOn(sql, 'exec');
    const parses = () => exec.mock.calls.filter(([q]) => q.startsWith('SELECT name, data')).length;
    const scoped = new RoomScopedStructure(() => sql);
    const judge = (tabId: string) =>
      scoped.admit({ kind: 'el', tabId, op: { kind: 'remove', id: 'b1' } }, { ...where, tabId });
    for (const id of ids) judge(id);
    expect(parses()).toBe(ids.length);
    judge(ids.at(-1)!);
    expect(parses()).toBe(ids.length);
    // The least recently judged was let go.
    judge('t1');
    expect(parses()).toBe(ids.length + 1);
  });
});
