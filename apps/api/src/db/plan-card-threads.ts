// The Inbox's Plan card comment threads (docs/specs/013-workspace/inbox.md §2.5). A card's thread lives in its
// item (`fields.comments`), in the document's room, which pushes each open thread to `collab_threads` under the tab
// key `~cards` with the card itself in `inbox_cards` (document-room/inbox-cards.ts); the read filters those rows
// and places each card as the cards read does.

import type { ActivityCardThread } from '@livedoc/api-schema';
import { CARD_BOARD_SQL, CARD_IN_SCOPE_SQL } from './plan-board-index';

// Appended to the Activity read's scope CTEs (?1 owner, ?2 now, ?3 limit; `me` and `my_members` from there). A
// thread is listed when the reader wrote in it, is mentioned in it, or owns the document. Author ids stay in the
// worker: only the latest author's name and colour leave it.
export const CARD_THREADS_CTES = `,
  cards AS (
    SELECT ic.document_id, ic.item_id AS id, ic.item_key, ic.type, ic.title,
           v.name AS document_name, v.team_id AS document_team_id, v.via, v.share_code,
           ${CARD_BOARD_SQL} AS board,
           ct.comment_count, ct.latest_text, ct.latest_author_name, ct.latest_author_color,
           ct.latest_at, ct.first_at,
           CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.participant_ids) je
                              WHERE je.value IN (SELECT id FROM me)) THEN 1 ELSE 0 END AS you_commented,
           CASE WHEN v.owner_id = ?1 THEN 1 ELSE 0 END AS on_your_document,
           CASE WHEN EXISTS (SELECT 1 FROM json_each(ct.mentioned_ids) jm
                              WHERE jm.value IN (SELECT id FROM me)
                                 OR jm.value IN (SELECT id FROM my_members)) THEN 1 ELSE 0 END AS mentions_you
      -- From the reader's documents to their card threads (CROSS JOIN fixes the order), as the element threads.
      FROM visible v
      CROSS JOIN collab_threads ct ON ct.document_id = v.id AND ct.tab_id = '~cards'
      JOIN inbox_cards ic ON ic.document_id = ct.document_id AND ic.item_id = ct.element_id
     WHERE ct.resolved = 0
       AND ${CARD_IN_SCOPE_SQL}
  )`;

export const CARD_THREADS_SELECT = `
  SELECT document_id, id, item_key, type, title, document_name, document_team_id, via, share_code, board,
         comment_count, latest_text, latest_author_name, latest_author_color, latest_at, first_at,
         you_commented, on_your_document, mentions_you
    FROM cards
   WHERE on_your_document = 1 OR you_commented = 1 OR mentions_you = 1
   ORDER BY latest_at DESC
   LIMIT ?3`;

export type CardThreadRow = {
  document_id: string;
  id: string;
  item_key: number;
  type: string;
  title: string | null;
  document_name: string;
  document_team_id: string | null;
  via: 'own' | 'team' | 'shared';
  share_code: string | null;
  board: string | null;
  comment_count: number;
  latest_text: string | null;
  latest_author_name: string | null;
  latest_author_color: string | null;
  latest_at: number | null;
  first_at: number | null;
  you_commented: number;
  on_your_document: number;
  mentions_you: number;
};

// A 'shared' row whose link has lapsed never arrives: `visible` (document-visibility.ts) drops it.
export function cardThreadsFromRows(rows: readonly CardThreadRow[]): ActivityCardThread[] {
  return rows.map((r) => ({
    documentId: r.document_id,
    documentName: r.document_name,
    teamId: r.document_team_id,
    via: r.via,
    shareCode: r.via === 'shared' ? r.share_code : null,
    board: r.board ? (JSON.parse(r.board) as ActivityCardThread['board']) : null,
    id: r.id,
    key: r.item_key,
    type: r.type,
    title: typeof r.title === 'string' ? r.title : '',
    commentCount: r.comment_count,
    latest: {
      text: r.latest_text ?? '',
      authorName: r.latest_author_name ?? '',
      authorColor: r.latest_author_color ?? '',
      at: r.latest_at ?? 0,
    },
    firstAt: r.first_at ?? 0,
    youCommented: r.you_commented === 1,
    onYourDocument: r.on_your_document === 1,
    mentionsYou: r.mentions_you === 1,
  }));
}
