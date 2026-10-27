// Removing documents from D1 (docs/specs/006-document/document-storage.md "Purging and copying"). A document's
// content lives in its room, which the caller purges after this batch (purgeRooms); a shared tab's other holders
// keep their own copies (docs/specs/006-document/tab-document-many-to-many.md). D1's derived rows (the Inbox's
// index, the placed images, the cards) cascade from `documents`.

import type { Env } from '../types';
import { imageGrantRemovalStatement } from './image-grants';

// Which documents are being removed: one by id, every document an owner holds,
// or a set of ids (the Trash purge, docs/specs/013-workspace/trash.md).
type DocumentSelector = { column: 'id' | 'owner_id'; value: string } | { ids: string[] };

// The WHERE clause over `documents` and its one bound value.
function selectorWhere(selector: DocumentSelector): { where: string; value: string } {
  if ('ids' in selector) {
    return { where: 'id IN (SELECT value FROM json_each(?))', value: JSON.stringify(selector.ids) };
  }
  return { where: `${selector.column} = ?`, value: selector.value };
}

// The statements, in order, for one D1 batch so it lands whole or not at all.
// The documents DELETE is last; its `meta.changes` is the document count.
export function documentRemovalStatements(
  env: Env,
  selector: DocumentSelector,
): D1PreparedStatement[] {
  const { where, value } = selectorWhere(selector);
  const doomed = `SELECT id FROM documents WHERE ${where}`;
  return [
    // Placement grants are keyed by document, without an FK
    // (docs/specs/009-elements/images.md, "Placement grants").
    imageGrantRemovalStatement(env, doomed, [value]),
    // The Google Drive mirror's rows (docs/specs/022-drive-mirror/drive-mirror.md, "Data"):
    // a removed document is no longer mirrored. The browser finishes the Drive
    // side from its own memory of the rows it saw.
    env.DB.prepare(
      `DELETE FROM drive_items WHERE item_kind = 'document' AND ld_id IN (${doomed})`,
    ).bind(value),
    env.DB.prepare(`DELETE FROM documents WHERE ${where}`).bind(value),
  ];
}
