# Blueprint: moving content into rooms

Derived from [Moving content into rooms](../document-storage-move.md); the room it fills is
[Document storage](document-storage.md).
Modelled on upstream `b0f6444618` (snapshot, plan, apply, verify, resumable) and livedocuments'
document migration door (the room writes a moved document in one transaction).

## Domain and naming

| Term            | Identifier                                                                                | Never             |
| --------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| Move            | `moveIntoRoom()` (`document-room/content-move.ts`); RPC `DocumentRoom.move`               | migrate, import   |
| Moved           | room key-value `content-move` present (`MoveOutcome`)                                     | migrated, synced  |
| Move gate       | `RoomContent.ensureMoved()`, after the handover, before every RPC and `fetch` is answered | lock              |
| Content hash    | `contentHashOf(content: MovableContent): Promise<string>` (`content-hash.ts`)             | checksum          |
| Movable content | `MovableContent`, the rows a move copies, in canonical order                              | snapshot, payload |
| Move record     | D1 `content_moves` row                                                                    | migration log     |
| Legacy room     | class `LegacyDocumentRoom`, binding `LEGACY_DOCUMENT_ROOM` (`legacy-document-room.ts`)    | old room          |
| Sweep           | `sweepContentMoves(env, now)` (`content-move-sweep.ts`), cron `* * * * *`                 | backfill          |
| Operator tool   | `apps/api/scripts/content-move.ts`, commands `plan` and `verify`                          | migrator          |

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
- A preview deploy runs v1 to v4 on fresh namespaces, which proves the sequence is accepted before production does;
  a preview already deployed with v1 and v2 proves v3 and v4 over existing namespaces.
- The class change ships in its own release (the foundation), with the handover below and no content change.
  A Worker rollback across it is refused by Cloudflare (a Durable Object lifecycle change), so faults are fixed
  forward.

### Room state handover (`legacy-handover.ts`)

- Every worker-to-room call goes through `documentRoom(env, id)` (`document-room/document-client.ts`): its RPCs carry
  the id as their first argument and its `fetch` adds `X-Document-Id: <id>`; a guard test fails on any stub made
  outside it.
- Both bind the room to that id first (`RoomContent.bind`, one id per room, `room_id_mismatch` otherwise: a thrown
  `RoomIdMismatchError` for an RPC, 409 for a fetch). Then, once per instance (an in-memory flag), the handover runs
  under `blockConcurrencyWhile`: `DocumentRoom.fetch` through `ensureReady`, every RPC through `RoomContent.rpc`, the
  only way an RPC reaches the content, so none skips it.
- `takeLegacyState(storage, legacy)`: when the key-value key `legacy-handover` is present, nothing; otherwise page
  `exportState` to the end, `put` every entry (pages of at most `HANDOVER_PUT_KEYS`, the key-value batch limit),
  then `put('legacy-handover', { at, keys })`; answers the count taken.
- After a take of one or more keys, the room re-restores `epoch`/`seq`, the baton, the poll and agent presence from
  storage and re-arms its alarm; then `legacy.clear()`, a failure logged and left.
- No `X-Document-Id` (a test double's request): no handover, logged once per instance.
- A failure before the marker is written: 503 `room_unavailable`, `Retry-After: 5`; the in-memory flag stays unset
  so the next request tries again. Entries already put are overwritten by the retry, verbatim, so it is idempotent.

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
- **Invariant M4**: `create` (unless it re-commits a document D1 already holds, which moves first) and `importCopy`
  set `content-move` to a born outcome (`markBorn`) in the gate: a new document is moved.
- **Guard G1**: the gate moves only when D1 holds a `documents` row for the id (trashed or not); otherwise it answers
  as an absent document, and the room stays `empty`.
- **Create order**: the worker calls `room.create` before it inserts the D1 row (so G1 never sees a row whose room
  is unfilled); a failed D1 insert purges the room.

### A move (`moveIntoRoom(env, documentId)`)

1. Read D1 (`readD1`): the `documents` row's deck, item catalogue and counters; `document_tabs` for the
   id; the tabs' bodies in groups of at most `MOVE_READ_BYTES` (lengths first, `length(data)`); `agent_changesets`
   and parts for the id; `items`, `sheets`, `sheet_cells`, `sheet_refs` for its tabs and id; for each tab, the other
   documents whose `document_tabs` hold it (the holders).
2. `d1Hash = contentHashOf(read)`; `d1Tabs = read.tabs.length`.
3. In one transaction: ensure the schema; write every row verbatim; recompute `tab_stats` (`tabStatsOfData`, dated
   by the tab's `updated_at`), `image_refs` (`imageRefIdsFromData`) and `plan_board_statuses` from each body; write
   `tab_shares` from the holders; read the room's own rows
   back into `MovableContent`; throw `MoveMismatchError` when its `canonicalJson` differs from D1's or the counts
   differ (the hash itself is asynchronous, so the transaction compares the text it is taken over: equal texts hash
   equally, and `roomHash` is then `d1Hash`; on a difference the room's hash is taken after the rollback); put
   `content-move`, the `MoveOutcome`.
4. After commit: upsert `content_moves` (`moved`); the outbox holds a `summary`, `images`, `cards`, `items` and every
   `tab` key (its triggers fired on the inserts), so the first drain fills D1's indexes.

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

### The operator tool (`apps/api/scripts/content-move.ts`, Node type stripping)

The shell parses arguments and runs wrangler; the pure core (`apps/api/src/document-room/content-move-plan.ts`: `assertSelect`,
`inlineId`, `planOf`, `verifyOf`) does the rest, so tests run it over node:sqlite. One wrangler call per document
carries all of its SELECTs. A document purged since the plan verifies as `gone`. Run from `apps/api` as
`node --import ../../scripts/ts-source-hooks.mjs scripts/content-move.ts plan --remote --out plan.json`.

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
d1Tabs: number | null; roomTabs: number | null; born: boolean; movedAt: number | null; error: string | null }`;
  null when D1 holds no row for the document (G1). The client's `documentRoom(env, id).move()`.
- D1 migration (with the storage blueprint's): `content_moves (document_id TEXT PRIMARY KEY REFERENCES documents (id)
ON DELETE CASCADE, status TEXT NOT NULL CHECK (status IN ('moved', 'failed', 'mismatch')), born INTEGER NOT NULL DEFAULT 0, d1_tabs INTEGER,
room_tabs INTEGER, d1_hash TEXT, room_hash TEXT, attempts INTEGER NOT NULL
DEFAULT 0, tried_at INTEGER NOT NULL, moved_at INTEGER, error TEXT)` (`0111_content_moves.sql`), indexed on
  `(status, tried_at)` for the sweep. `born = 1` marks a document created or copied in its room; the tool's `verify`
  passes it once `moved`, since D1 never held its content.
- The wire to the editor is unchanged; 503 `content_moving` (`Retry-After: 5`) is a new named answer on every
  document route, listed beside `room_unavailable` in the API app spec's storage section.

## Data and persistence

- Moved rows are content (private); `content_moves` holds ids, counts, hashes and error names, no content.
- D1's content tables stay byte-identical until the drop: the release adds no write to them (M3).
- Backups: D1 Time Travel covers D1 to the minute; a room's Point In Time Recovery covers 30 days.

## Errors and edge cases

| Case                                  | Handling                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------- |
| D1 read fails mid-move                | throw before the transaction; `failed`; 503                                |
| Legacy room unreachable at a handover | 503 `room_unavailable`; the next request tries again; content is untouched |
| Hashes or counts differ               | transaction undone; `mismatch`; `[content-move] mismatch` with both hashes |
| Record upsert fails after commit      | room moved; next sweep heals the record from `content-move`                |
| A tab in two documents                | each room copies it and lists the other as holder                          |
| A document with no tabs               | moves: `document` row only, `d1Tabs = 0`                                   |
| A document in the Trash               | moves like any other                                                       |
| A request during a move               | waits (M1), then answers from the moved room                               |
| A document purged before it moved     | its room stays `empty`; the record cascades away                           |
| A tab body over the 2 MB row cap      | cannot exist: D1 refused it with the same cap                              |
| Legacy key over the SQLite value cap  | cannot exist: key-value values were capped at 128 KiB                      |

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

| Fingerprint                                                                           | When                               |
| ------------------------------------------------------------------------------------- | ---------------------------------- |
| `[content-move] moved id=<id> tabs=<n> keys=<k> hash=<h8>`                            | a move commits                     |
| `[content-move] mismatch id=<id> d1=<h8> room=<h8> d1Tabs=<n> roomTabs=<m>`           | hashes or counts differ            |
| `[content-move] failed id=<id> stage=<read\|write\|record\|gate\|sweep> error=<name>` | any other failure                  |
| `[content-move] sweep found=<n> moved=<m> failed=<f>`                                 | a sweep run that found work        |
| `[legacy-handover] took id=<id> keys=<n>`                                             | a room takes its legacy state      |
| `[legacy-handover] failed id=<id> error=<name>`                                       | a handover fails before its marker |
| `[legacy-handover] clear failed id=<id>`                                              | after a handover                   |
| `[legacy-handover] no document id`                                                    | a call without `X-Document-Id`     |

## Testing

| Rule                                                        | Test                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| M1 no content served before moved; concurrent requests wait | `content-move.test.ts`                                              |
| M2 a mismatch or throw leaves the room unchanged            | `content-move.test.ts`                                              |
| M3 D1 content tables unchanged after a move                 | `content-move.test.ts` (row hash before and after)                  |
| M4 created and copied documents are born moved              | `content-move.test.ts`                                              |
| G1 no D1 row: no move, room stays empty                     | `content-move.test.ts`                                              |
| Hash identical in Node and in the room for the same rows    | `content-hash.test.ts`                                              |
| Shared tab moves into both holders                          | `content-move.test.ts`                                              |
| Legacy state taken verbatim once, restored, then cleared    | `legacy-handover.test.ts`                                           |
| Every room call names its document; every RPC hands over    | `document-client.test.ts` (guard), `document-room-handover.test.ts` |
| Handover failure answers 503 and retries                    | `legacy-handover.test.ts`                                           |
| Sweep order, batch, retry gap, idle, the cron               | `content-move-sweep.test.ts`                                        |
| Tool refuses a non-SELECT; verify pass and fail tables      | `document-room/content-move-plan.test.ts`                           |
| Drop guard fails with an unmoved document                   | `migrations` test on node:sqlite                                    |

## Constants and configuration

| Constant            | Value     | Provenance                                | Safe range              |
| ------------------- | --------- | ----------------------------------------- | ----------------------- |
| `MOVE_SWEEP_BATCH`  | 25        | well under a cron run's subrequest budget | 1 to 50                 |
| `MOVE_CONCURRENCY`  | 6         | Workers' open connections                 | 1 to 6                  |
| `MOVE_TIMEOUT_MS`   | 20,000    | a large document's read and write         | 5,000 to 30,000         |
| `MOVE_RETRY_MS`     | 3,600,000 | spec: at most once an hour                | 600,000 and up          |
| `MOVE_READ_BYTES`   | 8,000,000 | four tab caps per D1 read                 | 2,000,000 to 20,000,000 |
| `LEGACY_PAGE_KEYS`  | 512       | under the key-value list's practical page | 128 to 1,000            |
| `HANDOVER_PUT_KEYS` | 128       | the key-value `put` batch limit           | fixed                   |
| Retry-After         | 5 s       | a move takes well under a second          | 1 to 30                 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D17 to D22.
