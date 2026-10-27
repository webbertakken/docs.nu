import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { nodeDocumentSql, nodeTransaction } from '../test-document-sql';
import { DocumentDb } from './document-db';

function setup() {
  const raw = new DatabaseSync(':memory:');
  const ensureSchema = vi.fn(() => {
    raw.exec('CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  });
  const onWrite = vi.fn();
  const db = new DocumentDb(nodeDocumentSql(raw), {
    transaction: nodeTransaction(raw),
    ensureSchema,
    onWrite,
  });
  return { raw, db, ensureSchema, onWrite };
}

describe('DocumentDb', () => {
  it('answers first, all, run and raw in D1 shape', async () => {
    const { db } = setup();
    const ins = await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 1).run();
    expect(ins.meta.changes).toBe(1);
    await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('b', 2).run();
    expect(await db.prepare('SELECT n FROM t WHERE id = ?').bind('b').first('n')).toBe(2);
    expect(await db.prepare('SELECT id FROM t WHERE id = ?').bind('z').first()).toBeNull();
    const all = await db.prepare('SELECT id FROM t ORDER BY id').all<{ id: string }>();
    expect(all.results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(await db.prepare('SELECT id, n FROM t ORDER BY id').raw()).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('reports no changes for a read after a write', async () => {
    const { db } = setup();
    await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 1).run();
    expect((await db.prepare('SELECT * FROM t').run()).meta.changes).toBe(0);
  });

  it('binds booleans as 1 and 0, and refuses undefined', async () => {
    const { db } = setup();
    await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', true).run();
    expect(await db.prepare('SELECT n FROM t').first('n')).toBe(1);
    expect(() => db.prepare('SELECT ?').bind(undefined)).toThrow(/D1_TYPE_ERROR/);
  });

  it('rolls a whole batch back when one statement throws', async () => {
    const { db } = setup();
    await expect(
      db.batch([
        db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 1),
        db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 2),
      ]),
    ).rejects.toThrow();
    expect(await db.prepare('SELECT count(*) AS c FROM t').first('c')).toBe(0);
  });

  it('makes the schema before the first statement and tells the room about writes', async () => {
    const { db, ensureSchema, onWrite } = setup();
    await db.prepare('SELECT 1').first();
    expect(ensureSchema).toHaveBeenCalled();
    expect(onWrite).not.toHaveBeenCalled();
    await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 1).run();
    expect(onWrite).toHaveBeenCalledTimes(1);
  });
});
