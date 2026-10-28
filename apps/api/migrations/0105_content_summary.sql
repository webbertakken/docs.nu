-- The listing's view of a document's content (docs/specs/006-document/document-storage.md "The content summary"),
-- pushed by the document's room: JSON, or NULL until the first push (read as unknown, never empty).
ALTER TABLE documents ADD COLUMN content_summary TEXT NULL;
