# Blueprint: moving content into rooms

Derived from [Moving content into rooms](../document-storage-move.md); the room it fills is
[Document storage](document-storage.md).
Modelled on upstream `b0f6444618` (snapshot, plan, apply, verify, resumable) and livedocuments'
document migration door (the room writes a moved document in one transaction).

## Domain and naming

| Term            | Identifier                                                                             | Never             |
| --------------- | -------------------------------------------------------------------------------------- | ----------------- |
| Move            | `moveIntoRoom()` (`document-room/content-move.ts` (planned)); RPC `DocumentRoom.move`  | migrate, import   |
| Moved           | room key-value `content-move` present (`MoveOutcome`)                                  | migrated, synced  |
| Move gate       | `ensureMoved()`, first thing in every RPC and `fetch`                                  | lock              |
| Content hash    | `contentHashOf(content: MovableContent): Promise<string>` (`content-hash.ts`)          | checksum          |
| Movable content | `MovableContent`, the rows a move copies, in canonical order                           | snapshot, payload |
| Move record     | D1 `content_moves` row                                                                 | migration log     |
| Legacy room     | class `LegacyDocumentRoom`, binding `LEGACY_DOCUMENT_ROOM` (`legacy-document-room.ts`) | old room          |
| Sweep           | `sweepContentMoves(env, now)` (`content-move-sweep.ts`), cron `* * * * *`              | backfill          |
| Operator tool   | `apps/api/scripts/content-move.ts` (planned), commands `plan` and `verify`             | migrator          |

## Behaviour and state

### The class change (`wrangler.toml`, production and every preview)

```toml
[[durable_objects.bindings]]
name = "DOCUMENT_ROOM"
class_name = "DocumentRoom"

[[durable_objects.bindings]]
name = "LEGACY_DOCUMENT_ROOM"
class_name = "LegacyDocumentRoom"

[[migrations]]
tag = "v3"
renamed_classes = [{ from = "DocumentRoom", to = "LegacyDocumentRoom" }]

[[migrations]]
tag = "v4"
new_sqlite_classes = ["DocumentRoom"]
```

- v3 keeps every key-value room's storage under the new name; v4 makes the SQLite namespace under the old name.
- `LegacyDocumentRoom` exports `exportState(cursor: string | null): Promise<{ entries: [string, unknown][];
next: string | null }>` (pages of `LEGACY_PAGE_KEYS` keys by `storage.list({ startAfter, limit })`) and
  `clear(): Promise<void>` (`deleteAlarm`, `deleteAll`); its `fetch` answers 410 `room_moved`.
- A preview deploy runs v1 to v4 on fresh namespaces, which proves the sequence is accepted before production does.

### Move states (per document)

| State      | Room                             | `content_moves.status` |
| ---------- | -------------------------------- | ---------------------- |
| `unmoved`  | no `content-move` key            | none                   |
| `failed`   | unchanged                        | `failed`               |
| `mismatch` | unchanged                        | `mismatch`             |
| `moved`    | `content-move` key, content held | `moved`                |

Transitions: `unmoved|failed|mismatch → moved` (a move commits); `unmoved|failed|mismatch → failed|mismatch` (a move
throws or its hashes differ). `moved` is terminal.

- **Invariant M1**: a room serves no content until `moved`; `ensureMoved()` runs under `blockConcurrencyWhile`.
- **Invariant M2**: a move writes the room in one `transactionSync`, its key-value part through the synchronous
  `ctx.storage.kv` inside it; the hash check runs inside the same transaction and throws on a difference.
- **Invariant M3**: a move never writes D1's content tables; it writes only `content_moves`.
- **Invariant M4**: `create` and `importCopy` set `content-move` to `{ born: true }`: a new document is moved.
- **Guard G1**: the gate moves only when D1 holds a `documents` row for the id (trashed or not); otherwise it answers
  as an absent document, and the room stays `empty`.
- **Create order**: the worker calls `room.create` before it inserts the D1 row (so G1 never sees a row whose room
  is unfilled); a failed D1 insert purges the room.

### A move (`moveIntoRoom(env, documentId)`)

1. Read D1 (`readMovableContent`): the `documents` row's deck, item catalogue and counters; `document_tabs` for the
   id; the tabs' bodies in groups of at most `MOVE_READ_BYTES` (lengths first, `length(data)`); `agent_changesets`
   and parts for the id; `items`, `sheets`, `sheet_cells`, `sheet_refs` for its tabs and id; for each tab, the other
   documents whose `document_tabs` hold it (the holders).
2. Read the legacy room: every page of `exportState`.
3. `d1Hash = contentHashOf(read)`; `d1Tabs = read.tabs.length`.
4. In one transaction: ensure the schema; write every row verbatim; recompute `tab_stats` (`tabStatsOfData`, dated
   by the tab's `updated_at`), `image_refs` (`imageRefIdsFromData`) and `plan_board_statuses` from each body; write
   `tab_shares` from the holders; write the legacy entries through `ctx.storage.kv.put`; read the room's own rows
   back into `MovableContent`; `roomHash = contentHashOf(back)`; throw `move_mismatch` when `roomHash !== d1Hash` or
   the counts differ; put `content-move = { movedAt, d1Hash, roomHash, d1Tabs, roomTabs, legacyKeys }`.
5. After commit: upsert `content_moves` (`moved`); the outbox holds a `summary`, `images`, `cards`, `items` and every
   `tab` key (its triggers fired on the inserts), so the first drain fills D1's indexes.
6. `legacy.clear()`; a failure is logged and left: the legacy class is deleted whole in the drop release.

On a throw: no room change (M2); upsert `content_moves` with `failed` or `mismatch`, `attempts + 1`, `tried_at`,
`error` (the error's name, never content); the request that triggered the gate answers 503 `content_moving` with
`Retry-After: 5`.

A repeat on a moved room returns the stored `content-move` outcome and re-upserts `content_moves` from it, so a
record lost after a commit heals on the next sweep.

### Canonical content (`content-hash.ts`)

`MovableContent` is tuples in fixed column order, each list sorted by its key:

- `document`: `[presentation, item_types, item_types_rev, items_rev, items_next_key]`;
- `tabs`: `[id, name, data, rev, updated_at]` by `id`; `document_tabs`: `[tab_id, order_index, added_at, folder]`;
- `changesets`: every column of `agent_changesets` by `id`, then `agent_changeset_parts` by `(changeset_id, part)`;
- `items` by `id`; `sheets` by `id`; `sheet_cells` by `(sheet_id, row_id, col_id)`; `sheet_refs` by
  `(tab_id, sheet_id)`.

Derived rows (stats, image references, board statuses, holders) are not hashed: they are recomputed, not copied.
`contentHashOf` is SHA-256 (`crypto.subtle`, in Workers and Node alike) over `JSON.stringify` of that structure,
lower-case hex.

### The sweep

- Cron `* * * * *` → `sweepContentMoves(env, now)`:
  `SELECT d.id FROM documents d LEFT JOIN content_moves m ON m.document_id = d.id
 WHERE m.status IS NULL OR (m.status <> 'moved' AND m.tried_at < ?now - MOVE_RETRY_MS)
 ORDER BY m.document_id IS NOT NULL, d.created_at LIMIT MOVE_SWEEP_BATCH`.
- Each id: `room.move(id)`, `MOVE_CONCURRENCY` at once, each bounded by `MOVE_TIMEOUT_MS`.
- No rows: return at once without logging.

### The operator tool (`apps/api/scripts/content-move.ts` (planned), Node type stripping)

- `plan (--local | --remote) [--out <file>]`: for every `documents` row, the same reads as step 1 through
  `wrangler d1 execute DB --json --command <SELECT>`; prints `id, tabs, bytes, hash` and writes the JSON plan.
- `verify (--local | --remote) --plan <file>`: reads `content_moves`, recomputes each document's hash from D1, and
  passes when every document in the plan and in D1 is `moved`, every `d1_hash = room_hash = recomputed = planned`
  (a document created after the plan needs only the first three) and `d1_tabs = room_tabs`.
- The tool runs only statements that start with `SELECT`; anything else throws before wrangler runs.
- Exit 0 on pass, 1 on any failing document, 2 on a usage or wrangler error.

### The drop (a later release)

- D1 migration: a guard that fails while any document is not `moved`:
  `CREATE TABLE _content_move_guard (ok INTEGER NOT NULL CHECK (ok = 1));`
  `INSERT INTO _content_move_guard SELECT 0 WHERE EXISTS (SELECT 1 FROM documents d LEFT JOIN content_moves m ON
m.document_id = d.id WHERE m.status IS NOT 'moved');`
  then `DROP TABLE _content_move_guard` and the content tables (`tabs`, `document_tabs`, `tab_stats`,
  `image_refs`, `image_refs_backfill`, `agent_changesets`, `agent_changeset_parts`, `items`, `sheets`,
  `sheet_cells`, `sheet_refs`, `plan_board_statuses`, `collab_index_state`, `content_moves`).
- `wrangler.toml`: `[[migrations]] tag = "v5" deleted_classes = ["LegacyDocumentRoom"]`; the legacy binding, class,
  sweep cron and move code go.

## Interfaces and contracts

- RPC `DocumentRoom.move(documentId: string): Promise<MoveOutcome>` with
  `MoveOutcome = { status: 'moved' | 'failed' | 'mismatch'; d1Hash: string | null; roomHash: string | null;
d1Tabs: number | null; roomTabs: number | null; legacyKeys: number; born: boolean }`.
- D1 migration (with the storage blueprint's): `content_moves (document_id TEXT PRIMARY KEY REFERENCES documents (id)
ON DELETE CASCADE, status TEXT NOT NULL CHECK (status IN ('moved', 'failed', 'mismatch')), d1_tabs INTEGER,
room_tabs INTEGER, d1_hash TEXT, room_hash TEXT, legacy_keys INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL
DEFAULT 0, tried_at INTEGER NOT NULL, moved_at INTEGER, error TEXT)`.
- The wire to the editor is unchanged; 503 `content_moving` is a new named answer on every document route, listed in
  the OpenAPI manifest's shared responses.

## Data and persistence

- Moved rows are content (private); `content_moves` holds ids, counts, hashes and error names, no content.
- D1's content tables stay byte-identical until the drop: the release adds no write to them (M3).
- Backups: D1 Time Travel covers D1 to the minute; a room's Point In Time Recovery covers 30 days.

## Errors and edge cases

| Case                                 | Handling                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| D1 read fails mid-move               | throw before the transaction; `failed`; 503                                |
| Legacy room unreachable              | `failed`; retried; content not moved without its ledger                    |
| Hashes or counts differ              | transaction undone; `mismatch`; `[content-move] mismatch` with both hashes |
| Record upsert fails after commit     | room moved; next sweep heals the record from `content-move`                |
| A tab in two documents               | each room copies it and lists the other as holder                          |
| A document with no tabs              | moves: `document` row only, `d1Tabs = 0`                                   |
| A document in the Trash              | moves like any other                                                       |
| A request during a move              | waits (M1), then answers from the moved room                               |
| A document purged before it moved    | its room stays `empty`; the record cascades away                           |
| A tab body over the 2 MB row cap     | cannot exist: D1 refused it with the same cap                              |
| Legacy key over the SQLite value cap | cannot exist: key-value values were capped at 128 KiB                      |

## Security and trust

- No new door: moves run from the gate and the cron, and `move` is reachable only through the binding.
- The tool reads through the operator's own wrangler login and runs only `SELECT`.
- Logs and records carry ids, counts and hashes, never tab text.

## Performance and limits

- docs.nu: 14 documents and about 16 KB of tabs; one sweep run moves all of them in a few seconds.
- Worst case per move: one D1 batch per `MOVE_READ_BYTES` of bodies; a room transaction is bounded by the document's
  size (at most the tab cap per tab).
- The gate costs a moved room one key-value read on wake, cached in memory after.

## Observability

| Fingerprint                                                                      | When                        |
| -------------------------------------------------------------------------------- | --------------------------- |
| `[content-move] moved id=<id> tabs=<n> keys=<k> hash=<h8>`                       | a move commits              |
| `[content-move] mismatch id=<id> d1=<h8> room=<h8> d1Tabs=<n> roomTabs=<m>`      | hashes or counts differ     |
| `[content-move] failed id=<id> stage=<read\|legacy\|write\|record> error=<name>` | any other failure           |
| `[content-move] sweep found=<n> moved=<m> failed=<f>`                            | a sweep run that found work |
| `[content-move] legacy clear failed id=<id>`                                     | after a commit              |

## Testing

| Rule                                                        | Test                                               |
| ----------------------------------------------------------- | -------------------------------------------------- |
| M1 no content served before moved; concurrent requests wait | `content-move.test.ts`                             |
| M2 a mismatch or throw leaves the room unchanged            | `content-move.test.ts`                             |
| M3 D1 content tables unchanged after a move                 | `content-move.test.ts` (row hash before and after) |
| M4 created and copied documents are born moved              | `content-move.test.ts`                             |
| G1 no D1 row: no move, room stays empty                     | `content-move.test.ts`                             |
| Hash identical in Node and in the room for the same rows    | `content-hash.test.ts`                             |
| Shared tab moves into both holders                          | `content-move.test.ts`                             |
| Legacy state carried verbatim, then cleared                 | `content-move.test.ts`                             |
| Sweep order, batch, retry gap, idle                         | `content-move-sweep.test.ts`                       |
| Tool refuses a non-SELECT; verify pass and fail tables      | `scripts/content-move.test.ts` (planned)           |
| Drop guard fails with an unmoved document                   | `migrations` test on node:sqlite                   |

## Constants and configuration

| Constant           | Value     | Provenance                                | Safe range              |
| ------------------ | --------- | ----------------------------------------- | ----------------------- |
| `MOVE_SWEEP_BATCH` | 25        | well under a cron run's subrequest budget | 1 to 50                 |
| `MOVE_CONCURRENCY` | 6         | Workers' open connections                 | 1 to 6                  |
| `MOVE_TIMEOUT_MS`  | 20,000    | a large document's read and write         | 5,000 to 30,000         |
| `MOVE_RETRY_MS`    | 3,600,000 | spec: at most once an hour                | 600,000 and up          |
| `MOVE_READ_BYTES`  | 8,000,000 | four tab caps per D1 read                 | 2,000,000 to 20,000,000 |
| `LEGACY_PAGE_KEYS` | 512       | under the key-value list's practical page | 128 to 1,000            |
| Retry-After        | 5 s       | a move takes well under a second          | 1 to 30                 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D17 to D22.
