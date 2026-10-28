-- The Plan cards the Inbox reads (docs/specs/013-workspace/inbox.md §2.4, §2.5), pushed by each document's room:
-- every card assigned to someone or holding an open thread, with the boards that place it. `listed` is 1 when the
-- card is open by §2.4's rules (not linked, archived, in the Trash or in a Done column). `board` is its place for
-- an unscoped reader; `boards` every board on each tab that shows its status (or all cards), in tab then board
-- order, for a tab-scoped share's reader.
CREATE TABLE inbox_cards (
  document_id TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  item_id     TEXT    NOT NULL,
  item_key    INTEGER NOT NULL,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  status      TEXT,
  assignee_id TEXT,
  listed      INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  board       TEXT,
  boards      TEXT    NOT NULL DEFAULT '[]',
  PRIMARY KEY (document_id, item_id)
);
CREATE INDEX inbox_cards_assignee ON inbox_cards (assignee_id) WHERE listed = 1;
