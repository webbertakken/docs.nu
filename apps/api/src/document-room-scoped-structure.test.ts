import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, tabShowsEveryCard } from '@livedoc/items';
import { DocumentRoom } from './document-room/document-room';
import { migrateDocumentSchema } from './document-room/document-schema';
import { roomSqlStorage } from './test-document-room';

// A tab-scoped session in the room (docs/specs/013-workspace/tab-scoped-share-links.md "Realtime", "Structure"): its
// whole-tab op goes out under the stored name, and an op changing what pulls cards onto its tab is dropped, judged
// against the tab in the room's own SQLite as the frame arrives. A session with no scope never reads it.

const board = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  planBoard: presetSetup('kanban'),
};
const sticky = { id: 's1', type: 'sticky', x: 0, y: 0, width: 100, height: 80, label: 'hi' };
const card = { ...sticky, id: 'c9', type: 'shape', shape: 'plan-card', planCard: { itemId: 'i9' } };
const el = (op: unknown) => ({ kind: 'el', tabId: 't1', op });

type Socket = { sent: string[]; attachment: unknown };

// A room whose SQLite stores tab t1 ('Board': a board and a sticky), unless `stored` is false.
function newRoom(stored = true) {
  const sockets: Socket[] = [];
  const storage = roomSqlStorage();
  const sql = storage.sql as unknown as {
    exec: (q: string, ...b: unknown[]) => { toArray(): Record<string, unknown>[] };
  };
  migrateDocumentSchema((q) => sql.exec(q));
  if (stored)
    sql.exec(
      'INSERT INTO tabs (id, name, data, updated_at, rev) VALUES (?, ?, ?, 1, 1)',
      't1',
      'Board',
      JSON.stringify({ elements: [board, sticky] }),
    );
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    id: { equals: () => true },
    storage: {
      ...storage,
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(true),
      list: () => Promise.resolve(new Map()),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (id: string, tabScope: string | null) => {
    const s: Socket = {
      sent: [],
      attachment: {
        presenceId: id,
        verifiedRole: 'edit',
        presence: { id, name: id, color: '#abc', role: 'edit' },
        documentId: 'd1',
        tabScope,
        // What the upgrade computes (DocumentRoom.scopedTabShowsAll): the scoped tab read from the room's own store,
        // through tabShowsEveryCard. Only t1 is stored; another tab, or no store, reads as missing, so false.
        tabShowsAll: stored && tabScope === 't1' && tabShowsEveryCard([board, sticky]),
      },
    };
    sockets.push(s);
    return s;
  };
  return { room, join, sql };
}

// The room compares sockets by identity, so every frame from one fake comes through one WebSocket object.
const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = {
      send: (d: string) => void s.sent.push(d),
      serializeAttachment: (v: unknown) => void (s.attachment = v),
      deserializeAttachment: () => s.attachment,
    } as unknown as WebSocket;
    wsCache.set(s, ws);
  }
  return ws;
}

const frames = (s: Socket) => s.sent.map((f) => JSON.parse(f) as Record<string, unknown>);
const opsOf = (s: Socket) =>
  frames(s)
    .filter((f) => f.kind === 'op')
    .map((f) => f.op);
const send = (room: DocumentRoom, from: Socket, op: unknown) =>
  room.webSocketMessage(wsOf(from), JSON.stringify({ kind: 'op', op }));
const where = { documentId: 'd1', tabId: 't1' };

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('DocumentRoom: a tab-scoped session keeps its tab structure', () => {
  it('sends its whole-tab op out under the stored name', () => {
    const { room, join } = newRoom();
    const owner = join('O', null);
    const scoped = join('S', 't1');
    const tab = { id: 't1', name: 'Mine', elements: [board, sticky] };
    send(room, scoped, { kind: 'tab', tabId: 't1', tab });
    expect(opsOf(owner)).toEqual([{ kind: 'tab', tabId: 't1', tab: { ...tab, name: 'Board' } }]);
    expect(info).toHaveBeenCalledWith('[room] scoped tab op renamed back', where);
    // The sender learns the seq its op took, as for any relayed op.
    expect(frames(scoped).filter((f) => f.kind === 'cursor')).toHaveLength(1);
  });

  it('drops a Plan card it adds', () => {
    const { room, join } = newRoom();
    const owner = join('O', null);
    const scoped = join('S', 't1');
    send(room, scoped, el({ kind: 'add', element: card, at: 2 }));
    expect(opsOf(owner)).toEqual([]);
    expect(info).toHaveBeenCalledWith('[room] scoped structure dropped', {
      ...where,
      kind: 'el',
      why: 'reach',
    });
  });

  it('relays a board it moves', () => {
    const { room, join } = newRoom();
    const owner = join('O', null);
    const scoped = join('S', 't1');
    const moved = el({ kind: 'update', element: { ...board, x: 120 } });
    send(room, scoped, moved);
    expect(opsOf(owner)).toEqual([moved]);
  });

  it('drops a board it removes and a sticky it turns into a board, relaying what follows in order', () => {
    const { room, join } = newRoom();
    const owner = join('O', null);
    const scoped = join('S', 't1');
    const edit = el({ kind: 'update', element: { ...sticky, label: 'one' } });
    const reorder = el({ kind: 'reorder', ids: ['s1', 'b1'] });
    send(room, scoped, el({ kind: 'remove', id: 'b1' }));
    send(room, scoped, edit);
    send(room, scoped, el({ kind: 'update', element: { ...board, id: 's1' } }));
    send(room, scoped, reorder);
    expect(opsOf(owner)).toEqual([edit, reorder]);
  });

  it('leaves a session with no scope as it was: relayed as sent, the store never read', () => {
    const { room, join, sql } = newRoom();
    const exec = vi.spyOn(sql, 'exec');
    const owner = join('O', null);
    const peer = join('P', null);
    const removal = el({ kind: 'remove', id: 'b1' });
    const renamed = { kind: 'tab', tabId: 't1', tab: { id: 't1', name: 'Renamed' } };
    send(room, owner, removal);
    send(room, owner, renamed);
    expect(opsOf(peer)).toEqual([removal, renamed]);
    expect(exec.mock.calls.filter(([q]) => q.includes('FROM tabs'))).toEqual([]);
  });

  it('lets an op needing the store pass where the room stores no such tab', () => {
    const { room, join } = newRoom(false);
    const owner = join('O', null);
    const scoped = join('S', 't1');
    const removal = el({ kind: 'remove', id: 'b1' });
    send(room, scoped, removal);
    expect(opsOf(owner)).toEqual([removal]);
    expect(info).toHaveBeenCalledWith('[room] scoped structure unjudged', { ...where, kind: 'el' });
  });

  it('fails closed when the stored tab cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { room, join, sql } = newRoom();
    const exec = sql.exec.bind(sql);
    vi.spyOn(sql, 'exec').mockImplementation((q, ...b) => {
      if (q.includes('FROM tabs')) throw new Error('SQLITE_BUSY');
      return exec(q, ...b);
    });
    const owner = join('O', null);
    const scoped = join('S', 't1');
    send(room, scoped, el({ kind: 'remove', id: 's1' }));
    expect(opsOf(owner)).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[room] scoped check failed', {
      ...where,
      kind: 'el',
      error: 'Error: SQLITE_BUSY',
    });
  });
});
