import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DOCUMENT_CONVERSION_HEADER } from '@livedoc/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { deleteAccount } from './account';
import { deleteDocument } from './documents';
import { upsertTab } from './tabs';

// Deleting a document removes its D1 row, the rows its room pushed (they cascade from it) and, by purging its room,
// its content; another document's content is its own room's and stays whole
// (docs/specs/006-document/document-storage.md "Purging and copying"). Proven on a real SQLite with foreign keys on.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', teamId: string | null = null) {
  insert(sql, 'documents', {
    id,
    owner_id: ownerId,
    name: id,
    shareable: 0,
    team_id: teamId,
    saved_at: T0,
    created_at: T0,
  });
}

// A tab with one open action, written through the real autosave path, its Inbox row pushed.
async function tab(db: SqliteD1, documentId: string, id: string): Promise<void> {
  const action = {
    id: `act-${id}`,
    name: 'Do it',
    description: '',
    assignee: { userId: 'owner', name: 'Owner' },
    teamId: null,
    assignerId: 'owner',
    assignerName: 'Owner',
    status: 'open',
    createdAt: T0,
    updatedAt: T0,
  };
  await upsertTab(
    db.env,
    documentId,
    {
      id,
      name: id,
      elements: [
        {
          id: `el-${id}`,
          type: 'shape',
          shape: 'rectangle',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          action,
        },
      ],
    } as never,
    0,
  );
  await db.flush();
}

function count(sql: DatabaseSync, table: string, where: string, ...args: string[]): number {
  return Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args)?.n);
}

// What a document holds, in its room and in D1's pushed rows.
function footprint(sql: DatabaseSync, documentId: string) {
  return {
    row: count(sql, 'documents', 'id = ?', documentId),
    tabs: count(sql, 'document_tabs', 'document_id = ?', documentId),
    actions: count(sql, 'collab_actions', 'document_id = ?', documentId),
  };
}

const GONE = { row: 0, tabs: 0, actions: 0 };
const WHOLE = { row: 1, tabs: 1, actions: 1 };

describe('deleteDocument', () => {
  it('removes its row, its pushed rows and its content, and nothing of another document', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 't1');
    await tab(db, 'B', 't2');
    expect(footprint(db.sql, 'A')).toEqual(WHOLE);

    await deleteDocument(db.env, 'A');

    expect(footprint(db.sql, 'A')).toEqual(GONE);
    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(0);
    expect(footprint(db.sql, 'B')).toEqual(WHOLE);
  });
});

describe('DELETE /api/documents/:id?permanent=true', () => {
  function del(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2]) {
    return handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/A?permanent=true', { env: db.env, ...opts }),
    );
  }

  it('removes the document whole when the owner deletes from the Explorer', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');

    const res = await del(db, { owner: 'owner' });

    expect(res?.status).toBe(204);
    expect(footprint(db.sql, 'A')).toEqual(GONE);
  });

  it('removes a team document a teammate deletes', async () => {
    const db = sqliteD1();
    insert(db.sql, 'teams', { id: 'team', name: 'Team', created_at: T0, updated_at: T0 });
    insert(db.sql, 'team_members', {
      id: 'm-bob',
      team_id: 'team',
      user_id: 'user_bob',
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
    liveDoc(db.sql, 'A', 'user_alice', 'team');
    await tab(db, 'A', 't1');

    const res = await del(db, { owner: 'user_bob', sessionAccountId: 'user_bob' });

    expect(res?.status).toBe(204);
    expect(footprint(db.sql, 'A')).toEqual(GONE);
  });

  it('removes the document when it is taken offline', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');

    const res = await del(db, {
      owner: 'owner',
      headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });

    expect(res?.status).toBe(204);
    expect(footprint(db.sql, 'A')).toEqual(GONE);
  });
});

describe('deleteAccount', () => {
  it("removes the leaver's documents whole and keeps everyone else's", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'mine', 'user_leaver');
    liveDoc(db.sql, 'theirs', 'user_stays');
    await tab(db, 'mine', 'private');
    await tab(db, 'theirs', 'kept');

    await deleteAccount(db.env, 'user_leaver');

    expect(footprint(db.sql, 'mine')).toEqual(GONE);
    expect(footprint(db.sql, 'theirs')).toEqual(WHOLE);
  });
});
