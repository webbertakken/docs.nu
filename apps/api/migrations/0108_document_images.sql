-- The gallery images each document places (docs/specs/009-elements/images.md "Reference index"), pushed by the
-- document's room: what image retention, usage and grants read across documents.
CREATE TABLE document_images (
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  image_id    TEXT NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
CREATE INDEX document_images_image ON document_images (image_id);
