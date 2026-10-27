import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  deleteOldUnusedImages,
  IMAGE_SWEEP_PAGE,
  IMAGE_SWEEP_TRIPPED_MAX,
  sweepTripped,
} from './image-retention';
import { deleteDocument } from './documents';
import { upsertTab } from './tabs';
import {
  CUTOFF,
  DAY,
  liveDoc,
  ids,
  imageIds,
  images,
  OLD,
  refsFor,
  setup,
  tabWith,
  YOUNG,
} from './test-image-fixtures';

// The daily unused-image sweep (docs/specs/009-elements/images.md,
// "Retention"): reads only the placed images the rooms push (document_images), and keeps bytes
// whenever in doubt. Proven against a real SQLite with every migration.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sweepTripped', () => {
  it('trips only past both the share and the count', () => {
    expect(sweepTripped(21, 21)).toBe(true);
    expect(sweepTripped(20, 20)).toBe(false);
    expect(sweepTripped(60, 30)).toBe(false);
    expect(sweepTripped(60, 31)).toBe(true);
    expect(sweepTripped(0, 0)).toBe(false);
  });
});

describe('deleteOldUnusedImages', () => {
  it('is a no-op without an R2 binding', async () => {
    const { env, sql } = sqliteD1();
    images(sql, OLD, 'old');
    expect(await deleteOldUnusedImages(env, CUTOFF)).toBe(0);
    expect(imageIds(sql)).toEqual(['old']);
  });

  it('deletes nothing while a document has not pushed its images (not yet in its room)', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'old');
    await db.flush();
    db.sql.exec("UPDATE documents SET content_summary = NULL WHERE id = 'A'");
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(imageIds(db.sql)).toEqual(['old']);
    expect(db.bucket.delete).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'image sweep: paused, 1 documents have not pushed their images',
    );
  });

  it('reaps old unreferenced images only, D1 then R2', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B', 'someone-else');
    images(db.sql, OLD, 'old-unused', 'old-used', 'old-used-elsewhere');
    images(db.sql, YOUNG, 'young-unused');
    await upsertTab(db.env, 'A', tabWith('t1', 'old-used'), 0);
    // Store-wide: another owner's tab keeps an image alive.
    await upsertTab(db.env, 'B', tabWith('t2', 'old-used-elsewhere'), 0);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(imageIds(db.sql)).toEqual(['old-used', 'old-used-elsewhere', 'young-unused']);
    expect(db.bucket.delete).toHaveBeenCalledWith(['old-unused']);
  });

  it("reaps a removed tab's image once its document's push lands", async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'kept', 'on-removed-tab');
    await upsertTab(db.env, 'A', tabWith('t1', 'kept'), 0);
    await upsertTab(db.env, 'A', tabWith('gone', 'on-removed-tab'), 1);
    db.sql.exec("DELETE FROM tabs WHERE id = 'gone'");
    expect(refsFor(db.sql, 'on-removed-tab')).toBe(0);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(imageIds(db.sql)).toEqual(['kept']);
  });

  it('reaps the images of a deleted document', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'img');
    await upsertTab(db.env, 'A', tabWith('t1', 'img'), 0);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    await deleteDocument(db.env, 'A');
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
  });

  it('keeps an image placed after it was counted', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'late');
    await db.flush();
    const prepare = db.env.DB.prepare.bind(db.env.DB);
    // A push placing the image lands in the instant between the page read and the delete.
    vi.spyOn(db.env.DB, 'prepare').mockImplementation((query: string) => {
      if (query.startsWith('DELETE FROM images')) {
        db.sql.exec("INSERT INTO document_images (document_id, image_id) VALUES ('A', 'late')");
      }
      return prepare(query);
    });
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(0);
    expect(imageIds(db.sql)).toEqual(['late']);
    expect(db.bucket.delete).not.toHaveBeenCalled();
  });

  it('trips, logging loudly, but still deletes up to its cap when most old images look unreferenced', async () => {
    const db = setup();
    images(db.sql, OLD, ...ids('lost', 21));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(21);
    expect(imageIds(db.sql)).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      `image-sweep-tripwire: 21 of 21 old images unreferenced; deleting at most ${IMAGE_SWEEP_TRIPPED_MAX}, oldest first`,
    );
  });

  it('never latches: a tripped backlog drains one capped page per run, oldest first', async () => {
    const db = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Unused images far outnumber the one in use, as after a large Trash purge.
    liveDoc(db.sql, 'A');
    images(db.sql, OLD, 'used');
    await db.flush();
    db.sql.exec("INSERT INTO document_images (document_id, image_id) VALUES ('A', 'used')");
    const ancient = ids('ancient', 5);
    images(db.sql, OLD - DAY, ...ancient);
    images(db.sql, OLD, ...ids('later', IMAGE_SWEEP_TRIPPED_MAX));

    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(IMAGE_SWEEP_TRIPPED_MAX);
    expect(db.bucket.delete).toHaveBeenCalledTimes(1);
    const left = imageIds(db.sql);
    expect(left.filter((id) => id.startsWith('ancient'))).toEqual([]);
    expect(left).toHaveLength(5 + 1);

    // The next run (5 of 6 unused, under the tripwire count) reaps the rest.
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(5);
    expect(imageIds(db.sql)).toEqual(['used']);
  });

  it('pages through more unused images than one R2 call takes', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    const unused = ids('unused', IMAGE_SWEEP_PAGE + 1);
    const used = ids('used', IMAGE_SWEEP_PAGE + 2);
    images(db.sql, OLD, ...unused, ...used);
    await db.flush();
    const ref = db.sql.prepare(
      "INSERT INTO document_images (document_id, image_id) VALUES ('A', ?)",
    );
    for (const id of used) ref.run(id);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(IMAGE_SWEEP_PAGE + 1);
    expect(db.bucket.delete).toHaveBeenCalledTimes(2);
    expect(imageIds(db.sql)).toEqual(used);
  });

  it('stops cleanly after an exactly full last page', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    const unused = ids('unused', IMAGE_SWEEP_PAGE);
    const used = ids('used', IMAGE_SWEEP_PAGE);
    images(db.sql, OLD, ...unused, ...used);
    await db.flush();
    const ref = db.sql.prepare(
      "INSERT INTO document_images (document_id, image_id) VALUES ('A', ?)",
    );
    for (const id of used) ref.run(id);
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(IMAGE_SWEEP_PAGE);
    expect(db.bucket.delete).toHaveBeenCalledTimes(1);
  });

  it('logs an R2 failure with the ids and carries on', async () => {
    const db = setup();
    images(db.sql, OLD, 'a');
    db.bucket.delete.mockRejectedValueOnce(new Error('r2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await deleteOldUnusedImages(db.env, CUTOFF)).toBe(1);
    expect(error).toHaveBeenCalledWith('image sweep: R2 delete failed', ['a'], expect.any(Error));
  });
});
