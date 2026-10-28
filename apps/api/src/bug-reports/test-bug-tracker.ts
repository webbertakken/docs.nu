// A Bug Tracker document for the bug report tests (docs/specs/016-platform/bug-reports.md "The Bug Tracker board"):
// a board tab with a Reported, Triaged, Fixed board, the Bug Report and Task card types, a plain diagram tab, and a
// relay recorder in place of the room's broadcast. Not a `.test.ts` file, so vitest doesn't collect it as a suite.
import { sentJson } from '@livedoc/vitest-config/sent-request';
import { statusColumn, type Item, type PlanBoardSetup } from '@livedoc/items';
import type { SqliteD1 } from '../test-sqlite-d1';

export type Relayed = { op: { kind: string; upserts: Item[] } };

export const bugReportType = {
  id: 'bug-report',
  label: 'Bug Report',
  newTitle: 'New bug report',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'description', 'f-sev', 'f-shot', 'f-rep'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-shot', label: 'Screenshot', kind: 'link' },
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

export const trackerBoard = (extra: Partial<PlanBoardSetup> = {}): PlanBoardSetup => ({
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

export function writeTrackerBoards(db: SqliteD1, ...setups: PlanBoardSetup[]) {
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

// Document `tracker`, owned by `acct_webber`, tabs `board` and `notes`; answers the relays the room sends.
export function seedBugTracker(db: SqliteD1): Relayed[] {
  const relayed: Relayed[] = [];
  (db.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(sentJson(init) as Relayed);
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
  writeTrackerBoards(db, trackerBoard());
  return relayed;
}
