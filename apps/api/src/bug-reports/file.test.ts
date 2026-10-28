import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@livedoc/vitest-config/sent-request';
import type { BugReportFiling } from '@livedoc/api-schema';
import { ITEMS_MAX, statusColumn, type Item, type PlanBoardSetup } from '@livedoc/items';
import { listItems } from '../db';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { withTestDocumentRooms } from '../test-document-room';
import { fileBugReport } from './file';

let roomFails = false;
vi.mock('../document-room/document-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../document-room/document-client')>();
  return {
    ...real,
    documentRoom: (...args: Parameters<typeof real.documentRoom>) => {
      const room = real.documentRoom(...args);
      return roomFails
        ? { ...room, fileBugReport: () => Promise.reject(new Error('room down')) }
        : room;
    },
  };
});

// docs/specs/016-platform/bug-reports.md "Filing" steps 5-6 and "The Bug Tracker board": a Bug Report card in the
// first column of the first board that takes it, through the item store, or the reason the board did not take it.

let db: SqliteD1;
let relayed: { op: { kind: string; upserts: Item[] } }[];

const bugReportType = {
  id: 'bug-report',
  label: 'Bug Report',
  newTitle: 'New bug report',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'description', 'f-sev', 'f-rep'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-rep', label: 'Reporter', kind: 'text' },
  ],
};

const taskType = {
  ...bugReportType,
  id: 'task',
  label: 'Task',
  fields: ['title', 'status', 'description'],
  custom: [],
};

const board = (extra: Partial<PlanBoardSetup> = {}): PlanBoardSetup => ({
  title: 'Bugs',
  columns: [
    statusColumn('reported', 'Reported'),
    statusColumn('triaged', 'Triaged'),
    statusColumn('fixed', 'Fixed', { done: true }),
  ],
  swimlaneBy: 'none',
  cardFields: ['key'],
  hideWriting: false,
  ...extra,
});

function writeBoards(...setups: PlanBoardSetup[]) {
  const elements = setups.map((planBoard, i) => ({
    id: `b${i}`,
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: i * 600,
    width: 800,
    height: 500,
    planBoard,
  }));
  db.sql
    .prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 'board'`)
    .run(JSON.stringify({ kind: 'board', elements }));
}

const filing: BugReportFiling = {
  title: 'Save fails',
  details: 'Spins forever',
  reporter: { kind: 'guest', id: 'g-1' },
};

// The env itself, never a copy: its rooms are bound to it.
const env = (vars: Partial<Env> = {}) =>
  Object.assign(db.env, { BUG_REPORT_DOCUMENT_ID: 'tracker', BUG_REPORT_TAB_ID: 'board' }, vars);

const file = (vars: Partial<Env> = {}) => {
  const pending: Promise<unknown>[] = [];
  const vared = env(vars);
  withTestDocumentRooms(vared, undefined, (p) => void pending.push(p));
  return fileBugReport(vared, filing).then(async (out) => {
    await Promise.all(pending);
    return out;
  });
};

beforeEach(() => {
  db = sqliteD1();
  roomFails = false;
  relayed = [];
  (db.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(sentJson(init) as (typeof relayed)[number]);
        return new Response(null, { status: 204 });
      },
    }),
  };
  db.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at, item_types) VALUES ('tracker', 'acct_webber', 'Bug Tracker', 0, 1, 1, ?)`,
    )
    .run(JSON.stringify({ version: 1, types: [bugReportType, taskType] }));
  db.sql.exec(`
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('board', 'Bugs', '{"kind":"board","elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('notes', 'Notes', '{"kind":"diagram","elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('tracker', 'board', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('tracker', 'notes', 1, 1);
  `);
  writeBoards(board());
});

describe('fileBugReport', () => {
  it('makes a Bug Report card in the first column and relays it', async () => {
    expect(await file()).toEqual({ filed: true, number: 1 });
    const [card] = await listItems(db.env, 'tracker');
    expect(card).toMatchObject({
      type: 'bug-report',
      key: 1,
      fields: {
        title: 'Save fails',
        description: 'Spins forever',
        status: 'reported',
        'f-rep': 'Guest `g-1`',
      },
    });
    expect(card?.fields['f-sev']).toBeUndefined();
    expect(relayed.map((r) => r.op.upserts.map((i) => i.id))).toEqual([[card!.id]]);
  });

  it('numbers each card after the last', async () => {
    await file();
    expect(await file()).toEqual({ filed: true, number: 2 });
  });

  it('skips an Archive board and one that does not take the type', async () => {
    writeBoards(
      board({ archive: true }),
      board({ addTypes: ['task'], columns: [statusColumn('todo', 'To Do')] }),
      board({ columns: [statusColumn('new', 'New')] }),
    );
    expect(await file()).toEqual({ filed: true, number: 1 });
    expect((await listItems(db.env, 'tracker'))[0]?.fields['status']).toBe('new');
  });

  it.each([
    ['unconfigured', { BUG_REPORT_DOCUMENT_ID: '' }],
    ['unconfigured', { BUG_REPORT_TAB_ID: undefined }],
    ['document_missing', { BUG_REPORT_DOCUMENT_ID: 'nope' }],
    ['board_missing', { BUG_REPORT_TAB_ID: 'notes' }],
    ['board_missing', { BUG_REPORT_TAB_ID: 'gone' }],
  ] as const)('stores the report as %s', async (reason, vars) => {
    expect(await file(vars)).toEqual({ filed: false, reason });
    expect(await listItems(db.env, 'tracker')).toEqual([]);
  });

  it('stores it as document_missing when the document is in the Trash', async () => {
    db.sql.exec(`UPDATE documents SET trashed_at = 5 WHERE id = 'tracker'`);
    expect(await file()).toEqual({ filed: false, reason: 'document_missing' });
  });

  it('stores it as type_missing without a Bug Report type', async () => {
    db.sql.exec(`UPDATE document SET item_types = '{"version":1,"types":[]}' WHERE id = 'tracker'`);
    expect(await file()).toEqual({ filed: false, reason: 'type_missing' });
  });

  it('stores it as board_missing when the tab holds only an Archive board', async () => {
    writeBoards(board({ archive: true }));
    expect(await file()).toEqual({ filed: false, reason: 'board_missing' });
  });

  it('stores it as type_not_on_board when no board takes the type', async () => {
    writeBoards(board({ addTypes: ['task'] }));
    expect(await file()).toEqual({ filed: false, reason: 'type_not_on_board' });
  });

  it('stores it as board_full when the item store is full', async () => {
    const insert = db.sql.prepare(
      `INSERT INTO items (document_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('tracker', ?, 'bug-report', ?, 'a', '{}', 1, 1, 1, '{}', '{}')`,
    );
    for (let i = 1; i <= ITEMS_MAX; i += 1) insert.run(`i${i}`, i);
    expect(await file()).toEqual({ filed: false, reason: 'board_full' });
  });

  it('stores it as room_unavailable when the room fails', async () => {
    roomFails = true;
    expect(await file()).toEqual({ filed: false, reason: 'room_unavailable' });
  });
});
