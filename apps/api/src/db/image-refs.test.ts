import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { imageRefIdsFromData } from '../image-refs/extract';
import {
  documentImageIds,
  documentPlacesImage,
  imageRefIndexDocumentStatement,
} from './image-refs';

// The SQL extractor (indexing stored bodies, as a move into a room does) and the JavaScript one (every save) must
// agree on what a reference is (docs/specs/009-elements/images.md, "Reference index"): one the SQL side misses is
// an image the document's push leaves out of document_images, which the sweep would reap.

const pageFill = (imageId: unknown) => ({ kind: 'image', imageId });
const img = (imageId: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'e',
  type: 'image',
  imageId,
  ...extra,
});

// Valid JSON bodies only; a corrupt body is its own case below.
const CORPUS: Record<string, unknown> = {
  plain: { elements: [img('a'), img('b')] },
  duplicate: { elements: [img('a'), img('a')] },
  placeholder: { elements: [img(null)] },
  dataUri: { elements: [img('data:image/png;base64,AAAA')] },
  empty: { elements: [img('')] },
  numeric: { elements: [img(7)] },
  atCap: { elements: [img('x'.repeat(128))] },
  overCap: { elements: [img('y'.repeat(129))] },
  escaped: { elements: [img('q"uo\\te')] },
  unicode: { elements: [img('ïmägé-ü')] },
  otherType: { elements: [{ id: 's', type: 'shape', imageId: 'no' }] },
  capitalType: { elements: [{ id: 's', type: 'Image', imageId: 'no' }] },
  nestedOnly: { elements: [{ id: 'w', type: 'banner', children: [img('nested')] }] },
  mixedEntries: { elements: [null, 'image', 3, [img('in-array')], img('ok')] },
  elementsObject: { elements: { a: img('obj') } },
  elementsMissing: { theme: 'x' },
  topLevelArray: [img('top')],
  topLevelNull: null,
  settingsImageId: { imageId: 'setting', elements: [] },
  pagePicture: { elements: [], pages: [{ id: 'p', background: { fill: pageFill('pic') } }] },
  pageAndElement: {
    elements: [img('a')],
    pages: [
      { id: 'p', background: { fill: pageFill('a') } },
      { background: { fill: pageFill('b') } },
    ],
  },
  pageDataUri: { pages: [{ background: { fill: pageFill('data:image/png;base64,AA') } }] },
  pageSolid: { pages: [{ background: { fill: { kind: 'solid', color: '#fff', imageId: 'no' } } }] },
  pageJunk: { pages: [null, 'x', { background: null }, { background: { fill: pageFill(7) } }] },
  pagesObject: { pages: { p: { background: { fill: pageFill('obj') } } } },
};

function documentRow(sql: DatabaseSync, id: string) {
  sql
    .prepare(
      "INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, 'me', ?, 0, 0, 0)",
    )
    .run(id, id);
}

// A tab of document `documentId` (made on first use).
function tabRow(sql: DatabaseSync, id: string, data: string, documentId = 'D') {
  if (!sql.prepare('SELECT 1 FROM document WHERE id = ?').get(documentId))
    documentRow(sql, documentId);
  sql
    .prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 0)')
    .run(id, id, data);
  sql
    .prepare(
      'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, 0, 0)',
    )
    .run(documentId, id);
}

function refsByTab(sql: DatabaseSync): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of sql
    .prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id, image_id')
    .all()) {
    (out[r.tab_id as string] ??= []).push(r.image_id as string);
  }
  return out;
}

describe('the SQL extractor', () => {
  it('finds exactly what the JavaScript extractor finds', async () => {
    const { env, sql } = sqliteD1();
    const expected: Record<string, string[]> = {};
    for (const [name, body] of Object.entries(CORPUS)) {
      const data = JSON.stringify(body);
      tabRow(sql, name, data);
      const ids = imageRefIdsFromData(data).sort();
      if (ids.length > 0) expected[name] = ids;
    }
    await imageRefIndexDocumentStatement(env, 'D').run();
    expect(refsByTab(sql)).toEqual(expected);
    // The corpus exercises both sides, not just empties.
    expect(Object.keys(expected).sort()).toEqual([
      'atCap',
      'duplicate',
      'escaped',
      'mixedEntries',
      'pageAndElement',
      'pagePicture',
      'plain',
      'unicode',
    ]);
  });

  it('skips a corrupt body without failing the statement', async () => {
    const { env, sql } = sqliteD1();
    tabRow(sql, 'bad', '{"elements":[{"type":"image","imageId":"a"}');
    tabRow(sql, 'good', JSON.stringify({ elements: [img('b')] }));
    await imageRefIndexDocumentStatement(env, 'D').run();
    expect(refsByTab(sql)).toEqual({ good: ['b'] });
  });

  it("scopes to the document's own tabs", async () => {
    const { env, sql } = sqliteD1();
    tabRow(sql, 'ta', JSON.stringify({ elements: [img('ia')] }), 'A');
    tabRow(sql, 'tb', JSON.stringify({ elements: [img('ib')] }), 'B');
    await imageRefIndexDocumentStatement(env, 'B').run();
    expect(refsByTab(sql)).toEqual({ tb: ['ib'] });
  });
});

describe('what the room answers of its images', () => {
  it('lists every image the document places, once, and says where', async () => {
    const { env, sql } = sqliteD1();
    tabRow(sql, 't1', '{}');
    tabRow(sql, 't2', '{}');
    sql.exec(
      `INSERT INTO image_refs (tab_id, image_id) VALUES ('t1', 'a'), ('t1', 'b'), ('t2', 'a')`,
    );
    expect(await documentImageIds(env, 'D')).toEqual(['a', 'b']);
    expect(await documentPlacesImage(env, 'D', 'b', null)).toBe(true);
    expect(await documentPlacesImage(env, 'D', 'b', 't2')).toBe(false);
    expect(await documentPlacesImage(env, 'D', 'a', 't2')).toBe(true);
    expect(await documentPlacesImage(env, 'D', 'zz', null)).toBe(false);
    expect(await documentPlacesImage(env, 'other', 'a', null)).toBe(false);
  });
});
