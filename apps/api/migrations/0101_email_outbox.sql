-- Email kept instead of sent on hosts with EMAIL_OUTBOX=1: previews and the local e2e stack
-- (docs/specs/014-identity/auth-and-guest-access.md "Previews"; src/email/transport.ts). Empty everywhere else.
-- Rows older than a day are swept by the daily cron.
CREATE TABLE email_outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  text        TEXT NOT NULL,
  html        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX email_outbox_to_idx ON email_outbox (to_address, id);
