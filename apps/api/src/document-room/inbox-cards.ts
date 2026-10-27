// The Plan cards and card threads a document's room pushes for the Inbox (docs/specs/013-workspace/inbox.md §2.4,
// §2.5): every card that is open and assigned, or holds an open thread, with the boards that place it. Worked out
// here from the room's items and board statuses (the rules the D1-era read applied, moved unchanged); the reader's
// own part (whose assignee, who commented, who is mentioned, which tab a share is scoped to) stays in the read.

import type { DocumentEnv } from '../types';

// One `inbox_cards` row. `board`: the card's place for an unscoped reader; `boards`: every placement on a board
// showing its status or all cards, ordered by tab, then fit (its status before all cards), then board order, so a
// tab-scoped reader's place is the first on their tab.
export type InboxCardRow = {
  item_id: string;
  item_key: number;
  type: string;
  title: string;
  status: string | null;
  assignee_id: string | null;
  listed: number;
  updated_at: number;
  board: string | null;
  boards: string;
};

// One card thread, as `collab_threads` holds it under the tab key `~cards`.
export type CardThreadPush = {
  item_id: string;
  title: string;
  comment_count: number;
  participant_ids: string;
  mentioned_ids: string;
  latest_text: string | null;
  latest_author_name: string | null;
  latest_author_color: string | null;
  latest_at: number | null;
  first_at: number | null;
};

export const CARD_THREADS_TAB = '~cards';

const NOT_BINNED = `json_extract(i.fields, '$.archived') IS NOT 1
           AND json_extract(i.fields, '$.status') IS NOT 'trash'`;

const OPEN_THREAD = `json_extract(i.fields, '$.comments.resolved') = 0
           AND json_array_length(i.fields, '$.comments.comments') > 0
           AND ${NOT_BINNED}`;

// §2.4: assigned, not linked (its action is listed already), not archived or binned, and in no column any board of
// the document marks Done.
const LISTED = `json_extract(i.fields, '$.assignee.id') IS NOT NULL
           AND json_extract(i.fields, '$.linked') IS NULL
           AND ${NOT_BINNED}
           AND NOT EXISTS (
             SELECT 1 FROM document_tabs dt
               JOIN plan_board_statuses pb
                 ON pb.tab_id = dt.tab_id AND pb.status = json_extract(i.fields, '$.status')
              WHERE dt.document_id = i.document_id AND pb.done = 1)`;

// The boards holding a card's status ('*': an All Cards board), with their tab, in the order a placement prefers.
const PLACEMENTS = `
  SELECT pb.tab_id, t.name AS tab_name, pb.element_id, pb.board_title,
         CASE WHEN pb.status = c.status THEN 0 WHEN pb.status = '*' THEN 1 ELSE 2 END AS fit,
         dt.order_index, pb.board_order, pb.position
    FROM document_tabs dt
    JOIN plan_board_statuses pb ON pb.tab_id = dt.tab_id
    JOIN tabs t ON t.id = pb.tab_id
   WHERE dt.document_id = c.document_id`;

const PLACEMENT_JSON = `json_object('tabId', p.tab_id, 'tabName', p.tab_name,
                                 'elementId', p.element_id, 'title', p.board_title)`;

const CARDS_SQL = `
  WITH cards AS (
    SELECT i.document_id, i.id AS item_id, i.item_key, i.type, i.updated_at,
           COALESCE(json_extract(i.fields, '$.title'), '') AS title,
           json_extract(i.fields, '$.status') AS status,
           json_extract(i.fields, '$.assignee.id') AS assignee_id,
           CASE WHEN ${LISTED} THEN 1 ELSE 0 END AS listed,
           CASE WHEN ${OPEN_THREAD} THEN 1 ELSE 0 END AS open_thread
      FROM items i
     WHERE i.document_id = ?1
  )
  SELECT c.item_id, c.item_key, c.type, c.title, c.status, c.assignee_id, c.listed, c.updated_at,
         -- Its status's board, then an All Cards board, then any board, by tab then board order.
         (SELECT ${PLACEMENT_JSON} FROM (${PLACEMENTS}) p
           ORDER BY p.fit, p.order_index, p.board_order, p.position LIMIT 1) AS board,
         (SELECT COALESCE(json_group_array(json(placement)), '[]') FROM (
            SELECT ${PLACEMENT_JSON} AS placement FROM (${PLACEMENTS}) p
             WHERE p.fit < 2
             ORDER BY p.order_index, p.fit, p.board_order, p.position)) AS boards
    FROM cards c
   WHERE c.listed = 1 OR c.open_thread = 1
   ORDER BY c.item_id`;

const LATEST = `'$.comments.comments[#-1]`;
const COMMENTS = `json_each(i.fields, '$.comments.comments')`;

const CARD_THREADS_SQL = `
  SELECT i.id AS item_id, COALESCE(json_extract(i.fields, '$.title'), '') AS title,
         json_array_length(i.fields, '$.comments.comments') AS comment_count,
         (SELECT COALESCE(json_group_array(a), '[]') FROM (
            SELECT DISTINCT json_extract(c.value, '$.authorId') AS a FROM ${COMMENTS} c
             WHERE json_type(c.value, '$.authorId') = 'text')) AS participant_ids,
         (SELECT COALESCE(json_group_array(m), '[]') FROM (
            SELECT DISTINCT json_extract(n.value, '$.userId') AS m FROM ${COMMENTS} c, json_each(c.value, '$.mentions') n
             WHERE json_type(n.value, '$.userId') = 'text'
            UNION
            SELECT json_extract(n.value, '$.memberId') FROM ${COMMENTS} c, json_each(c.value, '$.mentions') n
             WHERE json_type(n.value, '$.memberId') = 'text')) AS mentioned_ids,
         json_extract(i.fields, ${LATEST}.text') AS latest_text,
         json_extract(i.fields, ${LATEST}.authorName') AS latest_author_name,
         json_extract(i.fields, ${LATEST}.authorColor') AS latest_author_color,
         json_extract(i.fields, ${LATEST}.createdAt') AS latest_at,
         json_extract(i.fields, '$.comments.comments[0].createdAt') AS first_at
    FROM items i
   WHERE i.document_id = ?1 AND ${OPEN_THREAD}
   ORDER BY i.id`;

export async function readInboxCards(
  env: DocumentEnv,
  documentId: string,
): Promise<{ cards: InboxCardRow[]; threads: CardThreadPush[] }> {
  const [cards, threads] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(CARDS_SQL).bind(documentId),
    env.DOCUMENT_DB.prepare(CARD_THREADS_SQL).bind(documentId),
  ]);
  return {
    cards: (cards?.results ?? []) as InboxCardRow[],
    threads: (threads?.results ?? []) as CardThreadPush[],
  };
}
