import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { migrateDocumentSchema } from './document-schema';
import {
  MOVABLE_TABLES,
  canonicalContent,
  contentHashOf,
  movableSelects,
  type MovableRows,
} from './content-hash';

const DOC = 'doc-1';

function seedD1(sql: DatabaseSync, doc = DOC, other = 'doc-2') {
  sql.exec(`
    INSERT INTO documents (id, owner_id, name, saved_at, created_at, presentation, items_rev, items_next_key)
      VALUES ('${doc}', 'o', 'D', 5, 1, '{"slides":[]}', 2, 3), ('${other}', 'o', 'E', 5, 1, NULL, 0, 1);
    INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES
      ('t2', 'Second', '{"elements":[]}', 4, 0, 1), ('t1', 'Café', '{"elements":[{"id":"e"}]}', 3, 1, 2),
      ('tx', 'Other', '{}', 3, 0, 0);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at, folder) VALUES
      ('${doc}', 't1', 0, 1, NULL), ('${doc}', 't2', 1, 2, 'F'), ('${other}', 'tx', 0, 1, NULL);
    INSERT INTO items (document_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
      VALUES ('${doc}', 'i1', 'card', 1, 'a', '{"title":"x"}', 1, 1, 1, 'p', 'p');
    INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
      VALUES ('${doc}', 's1', 't1', 'S', '{}', 1, 1, 1, 'p');
    INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input, format)
      VALUES ('${doc}', 's1', 'r1', 'c1', '42', NULL);
    INSERT INTO sheet_refs (tab_id, sheet_id) VALUES ('t1', 's1');
    INSERT INTO agent_changesets (id, document_id, tab_id, rev, author_id, author_name, author_color, fingerprints,
      added, changed, removed, created_at) VALUES ('c1', '${doc}', 't1', 1, 'a', 'A', '#000', '{}', 1, 0, 0, 9);
    INSERT INTO agent_changeset_parts (changeset_id, part, data) VALUES ('c1', 'ops', '[]');
  `);
}

function read(sql: DatabaseSync, head: 'documents' | 'document', id = DOC): MovableRows {
  const rows: MovableRows = {};
  for (const { table, sql: q } of movableSelects(head)) {
    rows[table] = sql.prepare(q).all(id);
  }
  return rows;
}

describe('the content hash', () => {
  it('names every content table a move copies', () => {
    expect(MOVABLE_TABLES.map((t) => t.table)).toEqual([
      'document',
      'tabs',
      'document_tabs',
      'agent_changesets',
      'agent_changeset_parts',
      'items',
      'sheets',
      'sheet_cells',
      'sheet_refs',
    ]);
  });

  it("reads only the document's own rows, in canonical order", () => {
    const { sql } = sqliteD1();
    seedD1(sql);
    const c = canonicalContent(read(sql, 'documents'));
    expect(c.tabs.map((t) => t[0])).toEqual(['t1', 't2']);
    expect(c.document).toEqual(['{"slides":[]}', null, 0, 2, 3]);
    expect(c.sheet_refs).toEqual([['t1', 's1']]);
  });

  it('gives the same hash for the same rows in D1 and in a room', async () => {
    const { sql } = sqliteD1();
    seedD1(sql);
    const fromD1 = await contentHashOf(canonicalContent(read(sql, 'documents')));

    const room = new DatabaseSync(':memory:');
    room.exec('PRAGMA foreign_keys = ON');
    migrateDocumentSchema((q) => {
      if (/^\s*SELECT/i.test(q)) return { toArray: () => room.prepare(q).all() };
      room.exec(q);
      return { toArray: () => [] };
    });
    room.exec(`INSERT INTO document (id, presentation, items_rev, items_next_key, saved_at, created_at)
      VALUES ('${DOC}', '{"slides":[]}', 2, 3, 5, 1)`);
    for (const { table } of MOVABLE_TABLES) {
      if (table === 'document') continue;
      for (const row of read(sql, 'documents')[table]!) {
        const keys = Object.keys(row);
        room
          .prepare(
            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          )
          .run(...(keys.map((k) => row[k]) as never[]));
      }
    }
    const fromRoom = await contentHashOf(canonicalContent(read(room, 'document')));
    expect(fromRoom).toBe(fromD1);
    expect(fromD1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any copied value changes', async () => {
    const { sql } = sqliteD1();
    seedD1(sql);
    const before = await contentHashOf(canonicalContent(read(sql, 'documents')));
    sql.exec("UPDATE sheet_cells SET input = '43'");
    expect(await contentHashOf(canonicalContent(read(sql, 'documents')))).not.toBe(before);
  });
});
