import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DOCUMENT_CONVERSION_HEADER } from '@livedoc/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { upsertTab } from '../db/tabs';
import { testDocumentRoom } from '../test-document-room';
import type { DocumentSeed } from '../document-room/document-create';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A created document's tabs are its own room's (docs/specs/006-document/offline-mode.md, "A synced-back tab keeps its
// id"): a seeded tab keeps the id it was sent with, and sits beside any other document's tab of that id, independent
// of it. A create cannot reach another document's tabs at all, so it can never rewrite one.

const T0 = 1_700_000_000_000;

function liveDoc(sql: DatabaseSync, id: string, ownerId: string) {
  sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    )
    .run(id, ownerId, id, T0, T0);
}

const square = (id: string, linkTo?: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...(linkTo ? { link: { kind: 'tab', tabId: linkTo } } : {}),
});

function post(db: SqliteD1, owner: string, body: unknown, headers: Record<string, string> = {}) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', { env: db.env, owner, body, headers }),
  );
}

function tabName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM tabs WHERE id = ?').get(id)?.name as string | undefined;
}

function tabsOf(sql: DatabaseSync, documentId: string) {
  return sql
    .prepare(
      `SELECT t.id, t.name, t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ? ORDER BY dt.order_index`,
    )
    .all(documentId)
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      data: JSON.parse(r.data as string) as { elements: { link?: { tabId?: string } }[] },
    }));
}

async function seed(db: SqliteD1, documentId: string, id: string, name = id) {
  await upsertTab(db.env, documentId, { id, name, elements: [] }, 0);
}

const seedOf = (tabs: DocumentSeed['tabs']): DocumentSeed => ({
  identity: {
    sessionAccountId: null,
    verifiedAccountId: null,
    accountEmail: null,
    sessionAuthTime: null,
    owner: 'owner',
    token: null,
    workbench: null,
  },
  owner: 'owner',
  recommit: false,
  savedAt: T0,
  createdAt: T0,
  presentation: null,
  itemTypes: null,
  tabs,
  items: [],
  sheets: [],
});

describe('POST /api/documents with tab ids', () => {
  it('syncs an offline copy back with its own tab ids, its links and deck as it built them', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A', 'owner');
    await seed(db, 'A', 'glossary', 'Glossary');
    // Take Offline removed A from the server.
    await handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/A', {
        env: db.env,
        owner: 'owner',
        headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
      }),
    );
    const deck = JSON.stringify({
      decks: [{ slides: [{ id: 's1', tabId: 'glossary', elementIds: ['g'] }] }],
    });

    const res = await post(
      db,
      'owner',
      {
        id: 'A',
        name: 'A',
        tabs: [
          { id: 'glossary', name: 'Glossary, edited offline', elements: [square('g')] },
          { id: 'own', name: 'own', elements: [square('s', 'glossary')] },
        ],
        presentation: deck,
      },
      { [DOCUMENT_CONVERSION_HEADER]: 'sync' },
    );

    expect(res?.status).toBe(201);
    const [glossary, own] = tabsOf(db.sql, 'A');
    expect(glossary).toMatchObject({ id: 'glossary', name: 'Glossary, edited offline' });
    expect(own!.data.elements[0]?.link?.tabId).toBe('glossary');
    const row = db.sql.prepare("SELECT presentation FROM document WHERE id = 'A'").get();
    expect(row!.presentation).toBe(deck);
  });

  it('keeps its tab ids when the same create is retried', async () => {
    const db = sqliteD1();
    const body = { id: 'N', name: 'N', tabs: [{ id: 'n1', name: 'One', elements: [] }] };

    await post(db, 'owner', body);
    await post(db, 'owner', body);

    expect(tabsOf(db.sql, 'N').map((t) => t.id)).toEqual(['n1']);
  });
});

describe("a room's tabs", () => {
  it('are its own: two documents each hold a tab of one id, independently', async () => {
    const victim = testDocumentRoom({} as Env);
    const other = testDocumentRoom({} as Env);
    await victim.room.create('V', seedOf([{ id: 'vt', name: 'Plans', elements: [] }]));
    await other.room.create('X', seedOf([{ id: 'vt', name: 'Overwritten', elements: [] }]));

    expect(tabName(victim.sql, 'vt')).toBe('Plans');
    expect(tabName(other.sql, 'vt')).toBe('Overwritten');
  });
});
