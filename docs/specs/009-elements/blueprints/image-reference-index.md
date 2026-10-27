# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Placement grants](../images.md#placement-grants), [Retention](../images.md#retention-unused-image-cleanup) and the
`GET /api/images/:id` and `GET /api/images/usage` rows of [API endpoints](../images.md#api-endpoints), with where the
index lives from [Document storage](../../006-document/document-storage.md). The spec decides; this file only adds
engineering precision. The room, its outbox and its drain are the
[document storage blueprint](../../006-document/blueprints/document-storage.md)'s; this file covers what they carry
for images. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                    | Role                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `src/document-room/document-schema.ts`  | The room's `image_refs`, `image_refs_image_idx` and the `images` outbox triggers |
| `src/image-refs/extract.ts`             | The JavaScript extractor: what a reference is                                    |
| `src/db/image-refs.ts`                  | Every statement on the room's `image_refs`; the SQL extractor; the room's reads  |
| `src/document-room/document-outbox.ts`  | `imagesStatements`: the document's whole set to D1, then its placement grants    |
| `migrations/0108_document_images.sql`   | D1's `document_images` and `document_images_image`                               |
| `src/db/image-grants.ts`                | `image_grants` writers and the serving predicate                                 |
| `src/image-refs/retention.ts`           | The daily image job                                                              |
| `src/db/image-retention.ts`             | The sweep, its gate and its tripwire                                             |
| `src/db/images.ts`                      | The usage map, reading `document_images`                                         |
| `src/routes/images.ts`                  | The byte endpoint's share check: D1's serving right and the room's place         |
| `src/db/tabs.ts`                        | `tabWriteStatements`, `seedTabs`, `swapTabData` carry index statements           |
| `src/document-room/document-content.ts` | `importDocumentCopy` carries index statements                                    |
| `src/index.ts`                          | `scheduled()` hands the daily run to `runImageRetention`                         |
| `src/image-refs/writer-census.test.ts`  | Fails when SQL writing `tabs` appears outside the known writers                  |

## Domain and naming

| Term          | Identifier                                             | Meaning                                                                      |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Reference     | row of the room's `image_refs` `(tab_id, image_id)`    | Tab `tab_id` places gallery image `image_id`                                 |
| Gallery id    | `isGalleryImageId(value)`                              | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed  |
| Reference ids | `imageRefIds(elements, pages)`                         | Distinct gallery ids of top-level image elements, then of image page fills   |
| Text scan     | `imageRefIdsFromText(data)`                            | Gallery ids after every `"imageId"` key in a body that isn't valid JSON      |
| Body ids      | `imageRefIdsFromData(data)`                            | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan  |
| Placed images | `documentImageIds(env, documentId)`                    | The document's whole set: distinct `image_id` over its tabs' references      |
| Pushed set    | D1 rows of `document_images` `(document_id, image_id)` | The placed images as the room's last drain pushed them                       |
| Pushed        | `documents.content_summary IS NOT NULL`                | The room has pushed at least once, so its pushed set is known                |
| Serving right | `servesSql(now)` in `db/image-grants.ts`               | Document `d` may serve image `i`: owner match, a grant, or an owner tied now |
| Tripwire      | `sweepTripped(old, unused)`                            | The sweep slowing to one capped page on a suspicious share                   |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers (in the room)

Each writer appends statements to the room batch that writes the body, so the index lands in the same transaction
(invariant R2 of the document storage blueprint).

| Writer                                               | Statements, in the body's batch                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tabWriteStatements` (`upsertTab`, `upsertTabAtRev`) | `imageRefReplaceStatements(env, id, imageRefIds(tab.elements, tab.pages))`                             |
| `seedTabs`                                           | the same, per seeded tab                                                                               |
| `importDocumentCopy`                                 | per copied tab: `imageRefAddStatements(env, id, imageRefIdsFromData(data))`                            |
| `swapTabData`                                        | `[UPDATE tabs … WHERE data = ?, ...imageRefAddStatements(nextData ids)]`; result 0's `changes` decides |
| `deleteTabRow`                                       | none: `DELETE FROM tabs` cascades the tab's references (`REFERENCES tabs (id) ON DELETE CASCADE`)      |
| the room's purge                                     | none: the room deletes its whole storage                                                               |

`imageRefReplaceStatements(env, tabId, ids)`, with `ids` bound as one JSON array:

1. `DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`
2. `imageRefAddStatements`: when `ids` is non-empty,
   `INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)`

A save whose image set is unchanged deletes nothing and inserts nothing, so it keys nothing in the outbox.

### Extraction in SQL

`walkSql(tabWhere, array, typeAt, kind, idAt)` selects `(tab_id, image_id)` over `tabs t` filtered by `tabWhere`,
joined to `json_each(<source>, array) e`, keeping rows where `e.type = 'object'`, the value at `typeAt` is `kind`,
the value at `idAt` is text of length 1 to `IMAGE_REF_ID_MAX_LENGTH` and does not start with `data:`. `<source>` is a
`CASE` giving `'{}'` when `t.data` lacks `"imageId"` (`instr`), is not valid JSON, or has no array at `array`, else
`t.data`; the `CASE` stops a corrupt body failing the statement and keeps `json_each` off image-free tabs.

`imageRefIndexDocumentStatement(env, documentId)` is one `INSERT OR IGNORE INTO image_refs` of two walks, with
`tabWhere = t.id IN (SELECT tab_id FROM document_tabs WHERE document_id = ?1)`: elements (`$.elements`, `$.type`,
`image`, `$.imageId`) `UNION ALL` page fills (`$.pages`, `$.background.fill.kind`, `image`,
`$.background.fill.imageId`). It indexes a document from stored bodies; the parity test holds it to the JavaScript
extractor.

### The push to D1

- **Keys.** Room triggers key `images` (key `''`) on `image_refs` insert and delete and on `document_tabs` insert and
  delete, in the write's transaction.
- **Unit.** The `images` key rides the drain's document unit (named `summary` in its log line), one D1 batch with the
  summary and cards. `imagesStatements(env, documentId, now)`:
  1. `ids = documentImageIds(env, documentId)`, sorted.
  2. `DELETE FROM document_images WHERE document_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`.
  3. Per `jsonChunks(ids)` chunk: `INSERT OR IGNORE INTO document_images (document_id, image_id) SELECT ?1, value
FROM json_each(?2) WHERE EXISTS (SELECT 1 FROM documents WHERE id = ?1)` (guard G2).
  4. `imageGrantPlacementStatements(env, documentId, ids, now)`.
- **Failure.** A failed unit keeps its keys; the room retries after `FLUSH_RETRY_MS`. The pushed set stays the last
  one that landed, which errs towards keeping bytes when an image was removed and towards the room's half of the
  share check when one was added.

### Retention

`runImageRetention(env, now)` (the cron's entry): `deleteOldUnusedImages(env, now - UNUSED_IMAGE_RETENTION_MS)`,
logging its count or its throw. It never rejects.

**Sweep** `deleteOldUnusedImages(env, cutoff)`:

1. No `IMAGES` binding: return 0.
2. Gate: `SELECT COUNT(*) AS n FROM documents WHERE content_summary IS NULL`; `n > 0` logs the pause and returns 0.
3. One pass: `SELECT COUNT(*) AS old, COALESCE(SUM(NOT live), 0) AS unused FROM images WHERE created_at < ?`.
4. `unused = 0`: return 0. `sweepTripped(old, unused)`: error-log the tripwire line, then select at most
   `IMAGE_SWEEP_TRIPPED_MAX` unreferenced old ids `ORDER BY created_at, id`, reap that one page as in step 5 and
   return its count.
5. Keyset pages on `id` (`id > last`), `IMAGE_SWEEP_PAGE` at a time, of unreferenced old ids:
   `DELETE FROM images WHERE id IN (json_each(?)) AND NOT live RETURNING id`, then `IMAGES.delete(ids)`; an R2 throw
   is logged with the ids and the sweep carries on. Stop on an empty or short page.
6. Return the number of D1 rows deleted.

`live` is `EXISTS (SELECT 1 FROM document_images r WHERE r.image_id = images.id)`, store-wide, whoever owns the
document. `sweepTripped(old, unused) = unused > IMAGE_SWEEP_TRIPWIRE_MIN && unused / old > IMAGE_SWEEP_TRIPWIRE_RATIO`.

### Readers

**Usage** `imageUsageByOwner(env, ownerId)`:
`SELECT DISTINCT r.image_id, d.id, d.name FROM documents d JOIN document_images r ON r.document_id = d.id WHERE d.owner_id = ? ORDER BY d.name, d.id`
(`D3`), folded into `Record<imageId, { id, name }[]>`.

**Share read** (the byte endpoint, `routes/images.ts`), for a visitor who passed `gateGrant`: allowed only when both
halves hold, D1's first:

1. `documentMayServeImage(env, documentId, imageId)`: one D1 query, `documents d JOIN images i` where
   `servesSql(now)` holds.
2. `documentRoom(env, documentId).placesImage(imageId, grant.tabScope)`: the room's `documentPlacesImage`,
   `document_tabs ⋈ image_refs` with `AND dt.tab_id = ?3` for a tab-scoped visitor.

A refusal logs `[images] not servable by document` with the document and image ids and answers 404. The room's half
reads the index in the transaction order of the save, so an image placed a moment ago serves at once.

**Render read** `servableImageIds(env, documentId, ids)`: of a tab's ids, those `servesSql` admits, one query over a
bound JSON array. `thumbnail.ts` `loadEmbeddedImages` reads R2 only for those; the rest keep the placeholder.

### Placement grants

`image_grants (document_id, image_id, created_at)`, primary key `(document_id, image_id)`, `WITHOUT ROWID`, no
foreign keys (migration 0075, which also granted every reference that already crossed owners).

- `entitledSql(now)`: image `i`'s owner is tied to document `d` right now: a `team_members` row with
  `team_id = d.team_id`, `user_id = i.owner_id`, `status = 'joined'`, OR a `shared_with` row with
  `owner_id = i.owner_id`, `document_id = d.id`, `role = 'edit'` or `level = 'participate'`, on a shareable document
  whose visit link is live (`visitLinkSql(now)`).
- `servesSql(now) = i.owner_id = d.owner_id OR <grant row exists> OR entitledSql(now)`. The last term serves an image
  its tied owner placed before the push writes its grant.
- **Placement writer** `imageGrantPlacementStatements(env, documentId, ids, now)`, in the push (above):
  `INSERT OR IGNORE` one row per pushed image where `i.owner_id <> d.owner_id` AND `entitledSql`. No row for an empty
  id list.
- **Copy writer** `imageGrantCopyStatements(env, sourceId, targetId, ids, now)`, in `copyDocument`'s D1 batch, with
  `ids` the distinct `imageRefIdsFromData` of the exported tabs: `INSERT OR IGNORE` the target for each id the source
  serves.
- **Owner change** `imageGrantOwnerChangeStatement(env, where, params, now)`, in the owner change's batch (team leave,
  library move, sign-up migration): grant each image in the documents' pushed sets that their outgoing owner owns.
- **Removal** `imageGrantRemovalStatement`, in `documentRemovalStatements`, keyed on the doomed documents.
- I5: a document serves an image only if `servesSql` holds; a grant is written only by the writers above and
  migration 0075.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: a room holds no reference whose tab is gone (the cascade); D1 holds no pushed row whose document is gone (the
  `documents` cascade and G2).
- I3: the sweep deletes nothing while any document is not yet pushed, and at most `IMAGE_SWEEP_TRIPPED_MAX` (the
  oldest unreferenced) while the tripwire holds; a tripped run never deletes zero when there is something to reap, so
  the tripwire cannot latch.
- I4: an image in a pushed set at the instant of its `DELETE` statement is not deleted.
- I6: after a drain that pushed the `images` key, the document's pushed set equals its placed images.

## Interfaces and contracts

```ts
// src/image-refs/extract.ts
export const IMAGE_REF_ID_MAX_LENGTH = 128;
export function isGalleryImageId(value: unknown): value is string;
export function imageRefIds(elements: unknown, pages?: unknown): string[];
export function imageRefIdsFromText(data: string): string[];
export function imageRefIdsFromData(data: string): string[];

// src/db/image-refs.ts (DocumentEnv: the room's SQLite as DOCUMENT_DB)
export function imageRefReplaceStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function imageRefAddStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function imageRefIndexDocumentStatement(
  env: DocumentEnv,
  documentId: string,
): D1PreparedStatement;
export async function documentImageIds(env: DocumentEnv, documentId: string): Promise<string[]>;
export async function documentPlacesImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
  onlyTabId: string | null,
): Promise<boolean>;

// src/db/image-grants.ts
export function imageGrantPlacementStatements(
  env: Env,
  documentId: string,
  ids: readonly string[],
  now: number,
): D1PreparedStatement[];
export async function documentMayServeImage(
  env: Env,
  documentId: string,
  imageId: string,
): Promise<boolean>;
export async function servableImageIds(
  env: Env,
  documentId: string,
  ids: string[],
): Promise<Set<string>>;

// src/document-room/document-client.ts (the room's RPC, document id bound)
placesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;

// src/image-refs/retention.ts
export const UNUSED_IMAGE_RETENTION_MS: number;
export async function runImageRetention(env: Env, now: number): Promise<void>;

// src/db/image-retention.ts
export function sweepTripped(old: number, unused: number): boolean;
export async function deleteOldUnusedImages(env: Env, cutoff: number): Promise<number>;
```

`imageRefIds` accepts `unknown` and returns `[]` for anything that isn't an array; a non-object entry is skipped. No
HTTP contract changes: `GET /api/images/usage` and `GET /api/images/:id` keep their shapes and status codes. A
`placesImage` call that throws is not wrapped in `askRoom`: it reaches the worker's outer catch, logged `api error`,
and answers 500; no bytes are served.

## Data and persistence

In the room (a schema step of `DOCUMENT_SCHEMA_STEPS`):

```sql
CREATE TABLE IF NOT EXISTS image_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS image_refs_image_idx ON image_refs (image_id);
```

A room never rebuilds `tabs` with `DROP TABLE`, so the cascade cannot empty the index the way a D1 rebuild could.

In D1 (`0108_document_images.sql`):

```sql
CREATE TABLE document_images (
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  image_id    TEXT NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
CREATE INDEX document_images_image ON document_images (image_id);
```

Both are derived data: `image_refs` from the room's `tabs.data`, `document_images` from `image_refs`. A document in
the Trash keeps its room and its pushed set until the purge. D1's `image_refs` and `image_refs_backfill` are content
tables the move reads and then drops ([Moving content into rooms](../../006-document/blueprints/document-storage-move.md)).
Neither table is owner-keyed, so neither account deletion nor owner migration lists them in
[Owner-keyed data](../../015-api/api.md#owner-keyed-data).

## Errors and edge cases

| Case                                                   | Handling                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                            |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                           |
| `elements` is an object, or missing                    | No references, on both extractors                                          |
| Corrupt body through `imageRefIdsFromData`             | Text scan; every id after `"imageId"` counts, image or not (over-keeps)    |
| Corrupt body in the SQL walk                           | No references from it; the statement does not fail                         |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps   |
| Tab deleted                                            | Its references cascade; the `images` key pushes the smaller set            |
| Two tabs place the same image, one goes                | The image stays in the placed set (`DISTINCT` over the rest)               |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                    |
| Drain fails                                            | Keys kept; the pushed set stays the last landed one; retried               |
| Drain races a purge                                    | G2: nothing inserted for a document whose row is gone                      |
| Document never pushed (not yet moved into its room)    | The sweep pauses for the whole store; usage omits its images               |
| Image placed after the last push                       | The byte endpoint serves it (room half); the sweep's 30-day floor keeps it |
| Tied owner's image placed before its grant is pushed   | `entitledSql` serves it until the grant lands                              |
| Image placed between count and delete                  | The `DELETE` re-checks the pushed set; it survives if pushed by then       |
| Unused count an exact multiple of the page             | A final empty page ends the loop                                           |
| R2 delete fails after D1 delete                        | Objects stay (bytes kept); ids logged; next page continues                 |
| Unreferenced share over the tripwire                   | At most one capped page, oldest first; error logged; drains over runs      |
| No `IMAGES` binding                                    | Sweep is a no-op; the index and the push still run                         |

## Security and trust

The share-read check authorises bytes to a share visitor, so it never says yes to an image the document doesn't
place, nor to one it places but may not serve (an id written into a document its owner has no tie to; see
[Placement grants](#placement-grants)). Both halves must hold: the room answers the place from its own index, D1 the
serving right; neither trusts the other's cache. The server renderer applies the serving right before reading R2. A
reference exists only from a body that placed the image; the add-only writers leave an extra one only when a
concurrent write raced, and only for an id that tab's body carried. `entitledSql` reads the tie at the request, so a
revoked link or a left team stops serving at once unless a grant was written. No input reaches SQL unbound: ids travel
as one bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

- **Save.** The index statements run in the room's SQLite inside the body's transaction; no D1 round trip. A save
  placing 500 images stays under 15 ms (`document-room-store.test.ts`).
- **Push.** One `json_each` read of the room's `image_refs` per drain, and in D1 one delete, `ceil(bytes /
JSON_CHUNK_BYTES)` inserts and one grant statement, at most once a minute per document (the drain's pace).
- **Sweep.** Deciding reads about `I + P` rows (`I` images, `P` pushed rows) and no tab body; it holds at most
  `IMAGE_SWEEP_PAGE` ids.
- **Usage.** One indexed join over the owner's documents and their pushed rows.
- **Share read.** One D1 query and one room RPC, each a primary-key or index probe.

## Observability

| Fingerprint                                                                                      | Level | When                              |
| ------------------------------------------------------------------------------------------------ | ----- | --------------------------------- |
| `image sweep: paused, <n> documents have not pushed their images`                                | info  | Sweep gated                       |
| `image-sweep-tripwire: <u> of <o> old images unreferenced; deleting at most <cap>, oldest first` | error | Tripwire                          |
| `image sweep: R2 delete failed`                                                                  | error | R2 threw after the D1 delete      |
| `image sweep: deleted <n> images older than <cutoff>`                                            | info  | End of every sweep                |
| `image sweep failed`                                                                             | error | The sweep threw                   |
| `[images] not servable by document`                                                              | warn  | The share read refused            |
| `api error`                                                                                      | error | The room's `placesImage` threw    |
| `[outbox] unit failed id=<id> unit=summary`                                                      | warn  | The document unit (images) failed |
| `[outbox] drained id=<id> units=<n> keys=<k> more=<bool>`                                        | info  | Every drain, images included      |

## Testing

| Rule                                                         | Test                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| What a reference is                                          | `src/image-refs/extract.test.ts`                                              |
| SQL extraction equals the JavaScript extractor               | `src/db/image-refs.test.ts` "the SQL extractor"                               |
| The room's placed images and place check                     | `src/db/image-refs.test.ts`, `src/db/images.test.ts`                          |
| Each writer maintains the index (I1), routes included        | `src/db/image-refs-writers.test.ts`                                           |
| Deleting a tab / document / account drops its references     | `src/db/image-refs-writers.test.ts`                                           |
| No unknown writer of `tabs`, code or migration               | `src/image-refs/writer-census.test.ts`                                        |
| The `images` key on reference and link changes               | `src/document-room/document-outbox-keys.test.ts`                              |
| The push lands, and writes nothing once the row is gone (G2) | `src/db/image-retention.test.ts`, `src/document-room/document-outbox.test.ts` |
| Sweep gate, pushed vs removed, tripwire, re-check (I3, I4)   | `src/db/image-retention.test.ts`                                              |
| The daily job logs its count and its failure                 | `src/image-refs/retention.test.ts`                                            |
| Usage reads the pushed sets                                  | `src/db/images.test.ts`                                                       |
| Serving right, grants, tab scope, copies, owner change (I5)  | `src/db/image-grants.test.ts`                                                 |
| A save placing 500 images stays in budget                    | `src/document-room/document-room-store.test.ts`                               |

All run against `src/test-sqlite-d1.ts` (real SQLite, every migration, each room's tables beside D1's, the outbox
drained before every D1 call); shared arrangement in `src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                     | Value                     | Provenance                          | Safe range              |
| ---------------------------- | ------------------------- | ----------------------------------- | ----------------------- |
| `IMAGE_REF_ID_MAX_LENGTH`    | 128                       | Spec; gallery ids are 36-char UUIDs | 36 to 512               |
| `UNUSED_IMAGE_RETENTION_MS`  | 30 days                   | Spec                                | ≥ 7 days                |
| `IMAGE_SWEEP_PAGE`           | 1000                      | Spec; R2 `delete()` key limit       | 1 to 1000               |
| `IMAGE_SWEEP_TRIPPED_MAX`    | 1000 (`IMAGE_SWEEP_PAGE`) | Spec; one R2 call a tripped day     | 1 to `IMAGE_SWEEP_PAGE` |
| `IMAGE_SWEEP_TRIPWIRE_RATIO` | 0.5                       | Spec (operator decision)            | 0 to 1                  |
| `IMAGE_SWEEP_TRIPWIRE_MIN`   | 20                        | Spec (operator decision)            | ≥ 0                     |

The drain's pace and chunking (`FLUSH_IDLE_MS`, `FLUSH_MIN_GAP_MS`, `FLUSH_RETRY_MS`, `JSON_CHUNK_BYTES`) are the
document storage blueprint's.

## Defaults ledger

`D3` in [DEFAULTS.md](DEFAULTS.md); `D1` and `D2` are retired with the backfill.
