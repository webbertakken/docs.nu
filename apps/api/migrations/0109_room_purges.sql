-- A purge a document's room still owes (docs/specs/006-document/document-storage.md "Purging and copying"): kept
-- until the room confirms it, retried by the daily cron.
CREATE TABLE room_purges (
  document_id     TEXT    PRIMARY KEY,
  requested_at    INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER
);
