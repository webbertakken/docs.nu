-- Bug reports the Bug Tracker's board could not take (docs/specs/016-platform/bug-reports.md "Filing"): kept with the
-- reason, refiled on a schedule, deleted once filed. `owner_id` is the reporter's id (NULL for anonymous).
CREATE TABLE bug_reports (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  reporter_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  context TEXT,
  screenshot_key TEXT,
  screenshot_url TEXT,
  reason TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL
);
CREATE INDEX idx_bug_reports_created ON bug_reports (created_at);
CREATE INDEX idx_bug_reports_owner ON bug_reports (owner_id);

-- The 600 s report window per visitor (docs/specs/016-platform/bug-reports.md "Filing" step 1): a hash of the
-- visitor's key, never an id.
CREATE TABLE bug_report_windows (
  visitor TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
