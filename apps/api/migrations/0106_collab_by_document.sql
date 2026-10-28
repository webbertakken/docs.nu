-- The Inbox's index keyed by document (docs/specs/013-workspace/inbox.md §2): the tabs live in each document's
-- room, out of D1's reach, so a row carries its tab's name and dies with its document. Rows are not carried: each
-- document's first drain after its move into its room refills them (docs/specs/006-document/document-storage-move.md).
DROP TABLE IF EXISTS collab_actions;
DROP TABLE IF EXISTS collab_threads;

CREATE TABLE collab_actions (
  document_id        TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id             TEXT    NOT NULL,
  tab_name           TEXT    NOT NULL,
  element_id         TEXT    NOT NULL,
  action_id          TEXT    NOT NULL,
  element_label      TEXT    NOT NULL,
  name               TEXT    NOT NULL,
  description        TEXT    NOT NULL,
  status             TEXT    NOT NULL,
  assignee_user_id   TEXT,
  assignee_member_id TEXT,
  assignee_name      TEXT,
  assigner_id        TEXT    NOT NULL,
  assigner_name      TEXT,
  team_id            TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  PRIMARY KEY (document_id, tab_id, element_id, action_id)
);
CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);
CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);
CREATE INDEX collab_actions_member_idx   ON collab_actions (assignee_member_id);

-- A Plan card's thread sits under the tab key '~cards', its element id the item id (§2.5).
CREATE TABLE collab_threads (
  document_id         TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id              TEXT    NOT NULL,
  tab_name            TEXT    NOT NULL,
  element_id          TEXT    NOT NULL,
  element_label       TEXT    NOT NULL,
  resolved            INTEGER NOT NULL,
  comment_count       INTEGER NOT NULL,
  participant_ids     TEXT    NOT NULL,
  mentioned_ids       TEXT    NOT NULL DEFAULT '[]',
  latest_text         TEXT    NOT NULL,
  latest_author_name  TEXT    NOT NULL,
  latest_author_color TEXT    NOT NULL,
  first_at            INTEGER NOT NULL,
  latest_at           INTEGER NOT NULL,
  PRIMARY KEY (document_id, tab_id, element_id)
);
CREATE INDEX collab_threads_open_idx ON collab_threads (resolved, latest_at);
