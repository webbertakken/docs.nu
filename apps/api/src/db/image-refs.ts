// image_refs: the image reference index (docs/specs/009-elements/images.md, "Reference index"), in the document's
// room. A projection of the image elements inside `tabs.data`, so the room answers which images it places without
// reading a tab body; its outbox pushes the document's whole set to D1's `document_images`
// (document-room/document-outbox.ts), which retention, the usage map and grants read across documents.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction as
// the blob it mirrors. The rows cascade from `tabs`.

import { IMAGE_REF_ID_MAX_LENGTH } from '../image-refs/extract';
import type { DocumentEnv } from '../types';

// ---------- Writers ---------------------------------------------------

// A body replace: drop the tab's references the new body no longer has, then
// add the ones it does. A save that changes no image writes no row.
export function imageRefReplaceStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  return [
    env.DOCUMENT_DB.prepare(
      'DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, JSON.stringify(ids)),
    ...imageRefAddStatements(env, tabId, ids),
  ];
}

// Add only: for a write that may have lost a race (the Q&A swap), where deleting could remove a reference the
// winner wrote.
export function imageRefAddStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DOCUMENT_DB.prepare(
      'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
    ).bind(tabId, JSON.stringify(ids)),
  ];
}

// ---------- Indexing from stored bodies --------------------------------

// The image ids a tab body places, walked in SQL: image elements' `imageId` and image page backgrounds' fill. A
// body that is not JSON, or names no image, indexes nothing. Used where bodies arrive without being parsed (a move
// into the room recomputes its references this way, docs/specs/006-document/document-storage-move.md).
function walkSql(
  tabWhere: string,
  array: '$.elements' | '$.pages',
  typeAt: string,
  kind: string,
  idAt: string,
): string {
  return `SELECT t.id AS tab_id, json_extract(e.value, '${idAt}') AS image_id
      FROM tabs t,
           json_each(CASE WHEN instr(t.data, '"imageId"') = 0 THEN '{}'
                          WHEN NOT json_valid(t.data) THEN '{}'
                          WHEN json_type(t.data, '${array}') = 'array' THEN t.data
                          ELSE '{}' END, '${array}') e
     WHERE (${tabWhere})
       AND e.type = 'object'
       AND json_extract(e.value, '${typeAt}') = '${kind}'
       AND json_type(e.value, '${idAt}') = 'text'
       AND length(json_extract(e.value, '${idAt}')) BETWEEN 1 AND ${IMAGE_REF_ID_MAX_LENGTH}
       AND substr(json_extract(e.value, '${idAt}'), 1, 5) <> 'data:'`;
}

// Index every tab of the document from its stored body.
export function imageRefIndexDocumentStatement(
  env: DocumentEnv,
  documentId: string,
): D1PreparedStatement {
  const tabWhere = 't.id IN (SELECT tab_id FROM document_tabs WHERE document_id = ?1)';
  return env.DOCUMENT_DB.prepare(
    `INSERT OR IGNORE INTO image_refs (tab_id, image_id)
    ${walkSql(tabWhere, '$.elements', '$.type', 'image', '$.imageId')}
    UNION ALL
    ${walkSql(tabWhere, '$.pages', '$.background.fill.kind', 'image', '$.background.fill.imageId')}`,
  ).bind(documentId);
}

// ---------- Readers ---------------------------------------------------

// Every image the document places, on any of its tabs: the set its outbox pushes to D1.
export async function documentImageIds(env: DocumentEnv, documentId: string): Promise<string[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT DISTINCT r.image_id FROM document_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id
      WHERE dt.document_id = ? ORDER BY r.image_id`,
  )
    .bind(documentId)
    .all<{ image_id: string }>();
  return results.map((r) => r.image_id);
}

// Whether the document places the image, on one tab when `onlyTabId` is given (a tab-scoped visitor): the image
// byte endpoint's place check (the `placesImage` RPC).
export async function documentPlacesImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
  onlyTabId: string | null,
): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT 1 AS present FROM document_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
      WHERE dt.document_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, documentId] : [imageId, documentId, onlyTabId]))
    .first<{ present: number }>();
  return row !== null;
}
