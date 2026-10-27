import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { assertSelect, inlineId, planOf, verifyOf, type Query } from './content-move-plan';

function d1() {
  const { sql } = sqliteD1();
  sql.exec(`
    INSERT INTO documents (id, owner_id, name, saved_at, created_at) VALUES ('a', 'o', 'A', 1, 1), ('b', 'o', 'B', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'T', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('a', 't1', 0, 1);
  `);
  const query: Query = async (statements) => statements.map((s) => sql.prepare(s).all() as never[]);
  return { sql, query };
}

describe('the operator tool', () => {
  it('runs only SELECT statements', () => {
    expect(() => assertSelect('DELETE FROM tabs')).toThrow(/only SELECT/);
    expect(() => assertSelect('  select 1')).not.toThrow();
    expect(() => assertSelect('SELECT 1; DROP TABLE tabs')).toThrow(/one statement/);
  });

  it('inlines a document id as a quoted literal', () => {
    expect(inlineId('WHERE id = ?1 OR x = ?1', "it's")).toBe("WHERE id = 'it''s' OR x = 'it''s'");
  });

  it('plans every document with its tab count, bytes and hash', async () => {
    const { query } = d1();
    const plan = await planOf(query);
    expect(plan.map((p) => [p.id, p.tabs, p.bytes])).toEqual([
      ['a', 1, 15],
      ['b', 0, 0],
    ]);
    expect(plan[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes only when every document moved with matching hashes', async () => {
    const { sql, query } = d1();
    const plan = await planOf(query);
    sql.exec(`CREATE TABLE IF NOT EXISTS content_moves (document_id TEXT PRIMARY KEY, status TEXT NOT NULL,
      d1_tabs INTEGER, room_tabs INTEGER, d1_hash TEXT, room_hash TEXT)`);
    const insert = sql.prepare('INSERT OR REPLACE INTO content_moves VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of plan) insert.run(p.id, 'moved', p.tabs, p.tabs, p.hash, p.hash);
    expect((await verifyOf(query, plan)).pass).toBe(true);

    insert.run('b', 'mismatch', 0, 0, plan[1]!.hash, 'f'.repeat(64));
    const failed = await verifyOf(query, plan);
    expect(failed.pass).toBe(false);
    expect(failed.rows.find((r) => r.id === 'b')!.problem).toBe('status mismatch');

    sql.exec("DELETE FROM content_moves WHERE document_id = 'a'");
    expect((await verifyOf(query, plan)).rows.find((r) => r.id === 'a')!.problem).toBe('not moved');
  });

  it('fails a document whose D1 content changed since the plan', async () => {
    const { sql, query } = d1();
    const plan = await planOf(query);
    sql.exec(`CREATE TABLE IF NOT EXISTS content_moves (document_id TEXT PRIMARY KEY, status TEXT NOT NULL,
      d1_tabs INTEGER, room_tabs INTEGER, d1_hash TEXT, room_hash TEXT)`);
    sql.exec("UPDATE tabs SET name = 'Changed'");
    const now = await planOf(query);
    const insert = sql.prepare('INSERT INTO content_moves VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of now) insert.run(p.id, 'moved', p.tabs, p.tabs, p.hash, p.hash);
    const result = await verifyOf(query, plan);
    expect(result.rows.find((r) => r.id === 'a')!.problem).toBe('changed since the plan');
  });
});

describe('a document purged since the plan', () => {
  it('passes as gone', async () => {
    const { sql, query } = d1();
    const plan = await planOf(query);
    sql.exec(`CREATE TABLE IF NOT EXISTS content_moves (document_id TEXT PRIMARY KEY, status TEXT NOT NULL,
      d1_tabs INTEGER, room_tabs INTEGER, d1_hash TEXT, room_hash TEXT)`);
    sql.exec("DELETE FROM documents WHERE id = 'b'");
    const insert = sql.prepare('INSERT INTO content_moves VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('a', 'moved', 1, 1, plan[0]!.hash, plan[0]!.hash);
    const result = await verifyOf(query, plan);
    expect(result.pass).toBe(true);
    expect(result.rows.find((r) => r.id === 'b')!.status).toBe('gone');
  });
});
