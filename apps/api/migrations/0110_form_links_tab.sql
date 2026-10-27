-- What the Inbox shows of a form (docs/specs/013-workspace/inbox.md, docs/specs/030-forms/forms.md "Hearing about
-- responses"): its tab's name, heading and board, pushed with the tab by the document's room.
ALTER TABLE form_links ADD COLUMN tab_name TEXT NOT NULL DEFAULT '';
ALTER TABLE form_links ADD COLUMN heading TEXT;
ALTER TABLE form_links ADD COLUMN board_tab_id TEXT;
