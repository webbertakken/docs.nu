# Blueprint: document storage

Derived from [Document storage](../document-storage.md),
[Tab ↔ document many-to-many](../tab-document-many-to-many.md) and
[One live service](../../003-system-architecture/one-live-service.md).
The move of existing documents has its own blueprint ([Moving content into rooms](document-storage-move.md)); content
search has its own ([Content search](../../013-workspace/blueprints/content-search.md)).
Ported by hand from upstream `77e511638f`, `8be9a0be46` and its index-app outbox kit; names below are
LiveDoc's.

## Domain and naming

| Term             | Identifier                                                                   | Never              |
| ---------------- | ---------------------------------------------------------------------------- | ------------------ |
| Room             | class `DocumentRoom`, binding `DOCUMENT_ROOM`, `apps/api/src/document-room/` | store, actor, DO   |
| Room's SQLite    | `env.DOCUMENT_DB` inside the room (`DocumentDb`, `document-db.ts`)           | local DB           |
| Content module   | a module whose SQL names a room table; typed on `DocumentEnv`                | repository         |
| Listing          | D1 `documents` and its satellites                                            | index row, item    |
| Content summary  | `ContentSummary` type, D1 column `documents.content_summary`                 | stats blob         |
| Outbox           | room table `outbox`, module `document-outbox.ts`                             | queue, journal     |
| Outbox key       | one `outbox` row: `(kind, key)`                                              | job, message       |
| Drain            | `drainOutbox()` in `document-outbox.ts`                                      | flush, sync        |
| Holder           | a document id in `tab_shares.document_id`                                    | member, peer       |
| Share send       | one `share_outbox` row; message `ShareMessage`                               | sync               |
| Room schema step | an entry of `DOCUMENT_SCHEMA_STEPS` (`document-schema.ts`)                   | migration (D1's)   |
| Purge tombstone  | D1 row in `room_purges`                                                      | pending delete     |
| Route identity   | `RouteIdentity` (`document-route.ts`), the caller as plain data              | session, principal |

`DocumentEnv = Env & { DOCUMENT_DB: D1Database }` (`types.ts`); a content module takes `DocumentEnv`, so the
compiler refuses a call from the worker, which has no `DOCUMENT_DB`.

## Behaviour and state

### Room lifecycle

| State    | Means                                                       | Enters by                      |
| -------- | ----------------------------------------------------------- | ------------------------------ |
| `empty`  | no `_document_schema` table: woken by an id, stores nothing | construction                   |
| `held`   | schema made, `document` row present                         | `create`, `importCopy`, a move |
| `purged` | storage deleted, alarm deleted                              | `purge`                        |

- **Invariant R1**: the schema is made on the first write (`ensureSchema` in `DocumentDb`), never on construction or a
  read; a read of an `empty` room answers as a document with no tabs.
- **Invariant R2**: every write of a room table runs inside `transactionSync`; a throw undoes the whole call.
- **Invariant R3**: an outbox or share-outbox key is written by a trigger in the transaction of the write it records.
- **Guard G1**: a request whose D1 `documents` row is missing answers as today (404, or 410 when trashed); the room's
  access checks are the same handlers (`gateRead`, `gateEdit`, `gateParticipate`).
- `purged` is terminal for the object; a later request finds `empty` and the D1 row gone.

### Schema

`document-schema.ts` holds `DOCUMENT_SCHEMA_STEPS: readonly string[]`; `migrateDocumentSchema(exec)` creates
`_document_schema (version INTEGER NOT NULL)`, runs each step past the stored version, and stores the count.
A later change appends a step and never edits one. `hasDocumentSchema(exec)` reads `sqlite_master` only.

### The outbox

Kinds and keys (`outbox (id INTEGER PRIMARY KEY, document_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
UNIQUE (document_id, kind, key))`; `document_id` is the room's one document, kept as a column like every content
table's so the content modules' SQL, and the tests' shared tables, stay keyed by document):

| Kind      | Key        | Written by triggers on                                                                                  | Drain pushes                                                |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `summary` | `''`       | `document` update, `document_tabs` insert/update/delete, `tab_stats` upsert                             | `documents.content_summary`, `documents.saved_at`           |
| `tab`     | the tab id | `tabs` insert/update/delete, `document_tabs` insert/delete, `sheet_cells` change on a sheet of that tab | collab rows, search text, tab-scoped link cleanup on delete |
| `cards`   | `''`       | `items` insert/update/delete, `plan_board_statuses` change                                              | `inbox_cards`, card threads in `collab_threads`             |
| `items`   | `''`       | `items` insert/update/delete                                                                            | the items' search text                                      |
| `images`  | `''`       | `image_refs` insert/delete                                                                              | `document_images` (whole set), grants                       |

- A trigger re-keys by `DELETE` then `INSERT` of `(kind, key)`, so a key written during a drain gets a new `id`.
- **Scheduling**: after every write `onWrite` computes `nextFlushAt(now, lastFlushAt) =
max(now + FLUSH_IDLE_MS, lastFlushAt + FLUSH_MIN_GAP_MS)` and arms the room's one alarm at the earliest deadline
  of: the drain, the share drain, upkeep, the facilitator grace and agent presence expiry (`armAlarm`).
- **Drain** (`drainOutbox(env, documentId)`): read keys ordered by `id`; the `summary`, `images`, `cards` and `items`
  keys plus at most `DRAIN_TABS` `tab` keys; build one D1 batch per pushed unit (the document unit: summary, images,
  cards, items; each tab its own unit); run at most `PUSH_CONCURRENCY` batches at once; delete exactly the keys whose
  batch succeeded (`DELETE FROM outbox WHERE id IN (...)`, the ids read, so a re-keyed one stays).
- **More**: when keys remain after a full drain, the next alarm is `now`; a failed unit sets the next alarm to
  `now + FLUSH_RETRY_MS`.
- **Guard G2**: every D1 statement a drain makes is guarded `WHERE EXISTS (SELECT 1 FROM documents WHERE id = ?)`,
  so a drain racing a purge writes nothing.
- **What a unit writes** (one D1 batch each):
  - document unit: `UPDATE documents SET content_summary = ?, saved_at = MAX(saved_at, ?) WHERE id = ?`;
    `document_images` delete and insert from a `json_each` chunk; grants (`imageGrantPlacementStatements`);
    `inbox_cards` and `collab_threads` under `~cards` replaced from `json_each` chunks; the `~items` search row.
  - tab unit, tab present: `onTabCollabChanged` (delete the tab's `collab_threads`/`collab_actions`, insert from
    `json_each` chunks with `tab_name`); the tab's `content_search` row (content search blueprint).
  - tab unit, tab gone: the same deletes, the search row's delete, and
    `DELETE FROM share_links WHERE document_id = ? AND tab_id = ?` plus the `shared_with` rows scoped to that tab.
- Each bound JSON value is chunked under `JSON_CHUNK_BYTES` (`jsonChunks`).

### The content summary

`ContentSummary = { v: 1; tabs: number; firstTabCount: number | null; stats: DocumentStats | null; hasContent:
boolean }`, built by `contentSummaryOf(sql)` in the room from `document_tabs`, `tabs.element_count`, `tab_stats`
(the existing `documentStatsSql` logic, now over the room's tables) and the empty test (the CASE of
`empty-document-sweep.ts` moved into the room unchanged). `readContentSummary(raw)` parses a D1 value and answers
`null` for absent or unreadable; `rowToSummary` maps `firstTabCount` through `isEmptyCount` only when the summary is
present, else `empty: false`.

### Routing

- `index.ts` keeps auth, rate limits, read-only tokens, workbench confinement and body caps.
- `routes/documents.ts` splits: `handleDocumentCollection` (list, `POST /api/documents`) stays in the worker;
  every path `/api/documents/:id/...` (`:id` a document id) goes to
  `documentRoom(env, id).route(id, request, identityOf(ctx))` (`room-client.ts`), WebSocket upgrades included through
  the same stub's `fetch`.
- `answerDocumentRequest(env, request, identity, waitUntil)` (`document-route.ts`) rebuilds `RouteContext` with
  `env` widened to `DocumentEnv` and runs `handleDocumentRequest(ctx)`, the existing handler tree.
- `RouteIdentity = { sessionAccountId, verifiedAccountId, accountEmail, sessionAuthTime, owner, token, workbench }`,
  the fields of LiveDoc's `RouteContext`.
- Create (D11): the worker validates the whole request, then calls `room.create(id, seed)` (`DocumentSeed`,
  `document-create.ts`), which stores the document row, tabs, items, sheets and deck and answers the first
  `ContentSummary` (or the refusal a store made, as `{ ok: false, status, body }`); then the worker writes the D1 row
  with `content_summary`. A genuine create whose room fails, refuses or whose D1 write fails purges the room again;
  a room failure answers 503 `room_unavailable`. A re-commit of the caller's own id never purges.
- Copy (`POST /api/documents/:id/copy`): source room `exportCopy(id)` → worker writes the new D1 row → target room
  `importCopy(newId, copy)` (`remapTabLinks` on the way) → summary as for create.

### Reads from outside a document's routes

| Caller                                  | RPC                                             | Answers                                               |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `GET /api/share/:code`, timeline, trash | `outline(id)`                                   | `{ tabs: TabSummaryDTO[], presentation, savedAt }`    |
| image bytes `GET /api/images/:id`       | `placesImage(id, imageId)`                      | `boolean`                                             |
| snapshot, share card, live image        | `image(id, request)`                            | `Response`                                            |
| public form respond (`routes/forms.ts`) | `respondToForm(id, request, identity)`          | the respond handler (`forms/respond.ts`), in the room |
| tab-scoped link mint and check          | `hasTab(id, tabId)`                             | `boolean`                                             |
| purge                                   | `purge(id)`                                     | `void`                                                |
| shared tabs                             | `sharedTabCopy`, `shareJoined`, `receiveShares` | (below)                                               |

### Shared tabs (`document-room/tab-shares.ts` (planned))

- Tables: `tab_shares (tab_id TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE, document_id TEXT NOT NULL,
PRIMARY KEY (tab_id, document_id)) WITHOUT ROWID`; `share_outbox (id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK
(kind IN ('body','join','leave')), tab_id TEXT NOT NULL, to_document TEXT NOT NULL, member TEXT NOT NULL DEFAULT
'', UNIQUE (kind, tab_id, to_document, member))`.
- Trigger `share_on_write AFTER UPDATE OF name, data ON tabs` inserts a `body` row per `tab_shares` holder unless
  the room's flag `receiving` (a one-row table `share_state (receiving INTEGER NOT NULL)`) is set.
- `ShareMessage = { kind: 'body'; tabId; name; data; updatedAt; members } | { kind: 'join'; tabId; member } |
{ kind: 'leave'; tabId }`; `ShareAnswer = 'ok' | 'gone'`.
- **Later write wins**: take a body when `(updatedAt, sha256(data))` is greater than the stored copy's.
- **No echo**: a received body is forwarded only to holders not in `members`.
- Drain: `drainShares()` sends at most `SHARE_DRAIN_MAX` messages, `PUSH_CONCURRENCY` at once, after
  `FLUSH_IDLE_MS` quiet; a failure keeps its row and retries after `FLUSH_RETRY_MS`; `gone` deletes the holder.
- Link route `POST /api/documents/:id/tabs/:tabId/link` body `{ from: string }`: 400 `invalid_request` without
  `from` or with `from === id`; 403 unless the caller `ownsDocument` both; 404 when `from` or the tab is missing;
  answers `{ tab: TabSummaryDTO }`; a repeat answers the stored tab.
- Leave on `deleteTabRow` and on `purge` (before `deleteAll`).
- A target that already holds an unrelated tab with that id is refused 409 `tab_id_taken`: tab ids are unique per
  document only ([Offline Mode](../offline-mode.md)).
- `GET /api/documents/:id/shared-tabs` counts from `tab_shares` (`sharedTabsSummary`).

### Purge

- `purgeDocuments(env, ids)` (D1) writes `room_purges (document_id TEXT PRIMARY KEY, requested_at INTEGER NOT NULL,
attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at INTEGER)` rows in the removal batch, then calls
  `purge` on each room (`ROOM_PURGE_CONCURRENCY` at once, `ROOM_PURGE_TIMEOUT_MS` each); a confirmed purge deletes
  its row.
- The daily cron retries at most `ROOM_PURGE_MAX_PER_RUN` rows whose `last_attempt_at` is older than
  `ROOM_PURGE_RETRY_MS`.
- **Guard G3**: the worker answers 404 for a document id with a `room_purges` row, before reaching the room.
- The room's `purge`: close sockets (`DOCUMENT_TRASHED_CLOSE`), settle the ledger, leave every shared tab (sends now,
  not queued), `deleteAlarm`, `deleteAll`.

### Upkeep

`maintain(now)` from the alarm, at most once per `UPKEEP_INTERVAL_MS` (stored `upkeep_at` key): delete changesets
older than `CHANGESET_RETENTION_DAYS` (the `agent_changeset_parts` cascade); delete sheets unreferenced longer than
the sheet store's 30 days (`sheet-sweep.ts` moved into the room). Removed from the worker: the sheet expiry and
changeset retention crons, and the tab stats, image reference and collaboration index backfills.

## Interfaces and contracts

- **RPC surface** (`DocumentRoom` methods, called only through `room-client.ts` helpers):
  `route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response>`;
  `create(documentId, seed: DocumentSeed): Promise<ContentSummary>`;
  `outline(documentId): Promise<DocumentOutline>`; `image(documentId, request): Promise<Response>`;
  `placesImage(documentId, imageId): Promise<boolean>`; `hasTab(documentId, tabId): Promise<boolean>`;
  `exportCopy(documentId): Promise<DocumentCopy>`; `importCopy(documentId, copy): Promise<ContentSummary>`;
  `respondToForm(documentId, request, identity): Promise<Response>`; `purge(documentId): Promise<void>`;
  `sharedTabCopy(documentId, tabId): Promise<SharedTabCopy | null>`;
  `shareJoined(documentId, tabId, member): Promise<void>`;
  `receiveShares(documentId, messages: ShareMessage[]): Promise<ShareAnswer[]>`.
- Every RPC first checks `documentId` against the id the room stores (`document.id`), or adopts it on `create`,
  `importCopy` and the move; a mismatch throws `room_id_mismatch` (a programming error, logged).
- The editor's, the MCP server's and the CLI's wire is unchanged, except the link route's `{ from }`.
- D1 migrations, from `0104` (after `0103_drop_community.sql`):
  1. `documents.content_summary TEXT NULL`.
  2. `collab_threads`, `collab_actions` rebuilt keyed `(document_id, tab_id, ...)`, `document_id` FK to
     `documents` `ON DELETE CASCADE`, `tab_name TEXT NOT NULL`, no FK to `tabs`; rows not carried (the first drain
     after each move refills them).
  3. `inbox_cards (document_id, item_id, item_key, type, title, status, assignee_id, updated_at, board JSON NULL,
PRIMARY KEY (document_id, item_id))`, index on `assignee_id`, FK `documents` cascade.
  4. `document_images (document_id, image_id, PRIMARY KEY (document_id, image_id)) WITHOUT ROWID`, index on
     `image_id`, FK `documents` cascade.
  5. `room_purges` (above).
  6. The content search tables (content search blueprint).
- D1's content tables (`tabs`, `document_tabs`, `tab_stats`, `image_refs`, `image_refs_backfill`,
  `agent_changesets`, `agent_changeset_parts`, `items`, `sheets`, `sheet_cells`, `sheet_refs`,
  `plan_board_statuses`, `collab_index_state`) are not touched by these migrations; the drop is the move blueprint's.

## Data and persistence

Room schema step 1 (`DOCUMENT_SCHEMA_STEPS[0]`), columns as in D1 today unless named:

| Table                                       | Key                            | Notes                                                                                                   |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `document`                                  | `id`                           | `presentation`, `item_types`, `item_types_rev`, `items_rev`, `items_next_key`, `saved_at`, `created_at` |
| `tabs`                                      | `id`                           | as D1, with the `tab_rev_stale` trigger                                                                 |
| `document_tabs`                             | `(document_id, tab_id)`        | FKs to `document` and `tabs`, cascade                                                                   |
| `tab_stats`                                 | `tab_id`                       | FK `tabs` cascade                                                                                       |
| `image_refs`                                | `(tab_id, image_id)`           | FK `tabs` cascade (no table rebuilds here, unlike D1's)                                                 |
| `agent_changesets`                          | `id`                           | FK `tabs` cascade                                                                                       |
| `agent_changeset_parts`                     | `(changeset_id, part)`         | FK cascade                                                                                              |
| `items`                                     | `(document_id, id)`            | as D1                                                                                                   |
| `plan_board_statuses`                       | `(tab_id, status, element_id)` | FK `tabs` cascade                                                                                       |
| `sheets`, `sheet_cells`, `sheet_refs`       | as D1                          | FKs within the room                                                                                     |
| `tab_shares`, `share_outbox`, `share_state` | above                          |                                                                                                         |
| `outbox`                                    | `id`, unique `(kind, key)`     |                                                                                                         |

- Classification: everything above is **content** (private to the document's readers); `outbox` and
  `share_outbox` are **derived**; the key-value room state is unchanged.
- D1's new rows are **derived** from content and safe to drop and refill: every drain is a full replace.
- Snapshot and restore: a room has Point In Time Recovery (30 days); D1 keeps Time Travel. D1 export does not support
  virtual tables, so an export drops the search tables first and recreates them after.

## Errors and edge cases

| Case                                             | Handling                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Room RPC throws or times out on a document route | 503 `room_unavailable`, `[room-route] failed id=<id> error=<name>`     |
| Create: room fails or refuses                    | room purged; 503 `room_unavailable`, or the refusal                    |
| Create: room stored, D1 insert fails             | room purged; the error answers 500                                     |
| Copy: target import fails                        | new D1 row deleted; 503; the source is untouched                       |
| Drain unit fails                                 | its keys stay; retry at `now + FLUSH_RETRY_MS`; `[outbox] unit failed` |
| Drain after the D1 row is gone                   | G2 writes nothing; keys deleted                                        |
| `tab_rev_stale` in a save                        | as today: 409 with the stored rev                                      |
| Tab over `MAX_TAB_BYTES`                         | as today: 413 `payload_too_large`, nothing written                     |
| Share send to a holder that is gone              | `gone`: holder deleted, `[tab-shares] holder gone`                     |
| Two holders write in the same millisecond        | the larger `sha256(data)` wins in both                                 |
| Link with `from` holding the tab in its Trash    | allowed: a trashed document still holds its tabs                       |
| Purge RPC fails                                  | tombstone kept; G3 hides the document; retried daily                   |
| Stray id wakes a room                            | `empty`; nothing stored (R1)                                           |
| Summary missing (never pushed)                   | listing `empty: false`; clean-up keeps it                              |
| Alarm fires with nothing due                     | re-arms from the remaining deadlines, or none                          |

## Security and trust

- Only the api Worker holds the `DOCUMENT_ROOM` binding; RPCs are not reachable from the edge. The room trusts
  `RouteIdentity` as it trusted the verified headers before, and re-runs every access check itself.
- Content never crosses into D1 except the derived index rows and search text, which carry nothing a reader of the
  document cannot already read; reads of them are access-filtered.
- `receiveShares` accepts a body only for a tab whose `tab_shares` lists the sender; otherwise `gone`.
- Rate limits and body caps run in the worker before the room, so a room is never the first line against abuse.

## Performance and limits

- Budgets (`document-room-store.test.ts`, node:sqlite as the room's SQLite, CPU time): a 1 MB tab saves under 60 ms
  and reads under 30 ms; a tab placing 500 images saves under 15 ms; a 200-tab outline under 10 ms; sending a 1 MB
  tab to 20 holders under 2 s in total.
- A drain writes at most `DRAIN_TABS` tab units, each one D1 batch; at most `PUSH_CONCURRENCY` in flight; subrequests
  per drain stay under 60, inside the Durable Object budget.
- Durable Object SQLite: 2 MB per row or value (the tab cap), 10 GB per object; D1 statement limits (100 bound
  parameters, 100 KB of SQL) are met by `json_each` chunks.
- The save path makes no D1 round trip; D1 reads per list page are unchanged in count (the subqueries over `tabs` and
  `tab_stats` become one column).

## Observability

| Fingerprint                                                               | When                    |
| ------------------------------------------------------------------------- | ----------------------- |
| `[room-route] failed id=<id> path=<path> error=<name>`                    | a routed request throws |
| `[room-schema] migrated id=<id> from=<n> to=<m>`                          | a schema step runs      |
| `[outbox] drained id=<id> units=<n> keys=<k> more=<bool>`                 | every drain             |
| `[outbox] unit failed id=<id> unit=<summary\|tab:<tabId>> error`          | a unit's batch fails    |
| `[tab-shares] sent id=<id> to=<doc> kind=<k> answer=<a>`                  | each share message      |
| `[tab-shares] holder gone id=<id> tab=<tab> holder=<doc>`                 | a holder answers `gone` |
| `[room-purge] purged id=<id>` / `[room-purge] failed id=<id> attempt=<n>` | each purge try          |
| `[room-upkeep] id=<id> changesets=<n> sheets=<m>`                         | each upkeep run         |

## Testing

| Rule                                                              | Test                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1 schema on first write only                                     | `document-schema.test.ts`                                                    |
| R2 a throw undoes the call                                        | `document-db.test.ts` (batch rollback)                                       |
| R3 every write path keys the outbox                               | `document-outbox.test.ts`, one case per table                                |
| Drain bounds, retry, re-keyed key survives a drain                | `document-outbox.test.ts`                                                    |
| G2 no write after purge                                           | `document-outbox.test.ts`                                                    |
| Summary equals the D1-era subqueries on the same tabs             | `content-summary.test.ts`                                                    |
| Routing hands every `/api/documents/:id/` path to the room        | `document-route.test.ts`                                                     |
| Access checks unchanged per route                                 | existing route tests, run through the room harness (`test-document-room.ts`) |
| Shared tabs: join, write, later wins, no echo, leave, gone, purge | `tab-shares.test.ts`                                                         |
| Link route answers 400/403/404/200                                | `tab-link-route.test.ts`                                                     |
| G3 tombstoned id answers 404                                      | `room-purge.test.ts`                                                         |
| Upkeep deletes old changesets and sheets                          | `document-room-upkeep.test.ts`                                               |
| Budgets                                                           | `document-room-store.test.ts`                                                |
| Inbox reads the pushed rows                                       | `collab-index.test.ts`, `activity-cards.test.ts`                             |

## Constants and configuration

| Constant                    | Value      | Provenance                                   | Safe range           |
| --------------------------- | ---------- | -------------------------------------------- | -------------------- |
| `FLUSH_IDLE_MS`             | 2,000      | upstream outbox                              | 500 to 10,000        |
| `FLUSH_MIN_GAP_MS`          | 60,000     | upstream outbox ("at most once a minute")    | 10,000 to 300,000    |
| `FLUSH_RETRY_MS`            | 60,000     | upstream outbox                              | 10,000 to 600,000    |
| `DRAIN_TABS`                | 50         | upstream outbox                              | 10 to 100            |
| `PUSH_CONCURRENCY`          | 6          | upstream outbox; Workers' 6 open connections | 1 to 6               |
| `JSON_CHUNK_BYTES`          | 1,000,000  | half D1's 2 MB value cap                     | 100,000 to 1,900,000 |
| `SHARE_DRAIN_MAX`           | 50         | upstream tab-shares                          | 10 to 100            |
| `ROOM_PURGE_CONCURRENCY`    | 10         | today's `purgeRooms`                         | 1 to 20              |
| `ROOM_PURGE_TIMEOUT_MS`     | 3,000      | today's `purgeRooms`                         | 1,000 to 10,000      |
| `ROOM_PURGE_MAX_PER_RUN`    | 300        | upstream index purge                         | 50 to 1,000          |
| `ROOM_PURGE_RETRY_MS`       | 3,600,000  | upstream index purge ("once an hour")        | 600,000 and up       |
| `UPKEEP_INTERVAL_MS`        | 86,400,000 | the daily crons it replaces                  | 3,600,000 and up     |
| `SQLITE_ROW_MAX_BYTES`      | 2,000,000  | Durable Object SQLite limit                  | fixed                |
| `SQLITE_ROW_HEADROOM_BYTES` | 8,192      | today's `D1_ROW_HEADROOM_BYTES`              | fixed                |

`SQLITE_ROW_MAX_BYTES` and `SQLITE_ROW_HEADROOM_BYTES` replace `D1_MAX_ROW_BYTES` and `D1_ROW_HEADROOM_BYTES` in
`@livedoc/api-schema`; `MAX_TAB_BYTES` keeps its value.
`wrangler.toml`: the class migration is the move blueprint's; no new binding here.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D7 to D16.
