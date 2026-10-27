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
| Room client      | `documentRoom(env, id)`: `DocumentRoomClient` (`document-client.ts`)         | stub, room helper  |
| Room content     | `RoomContent` (`room-content.ts`): the room's SQLite, RPC gate and drain     | store              |
| Room RPC         | a member of `DocumentRoomRpc` (`document-rpc.ts`)                            | endpoint           |
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

| Kind      | Key        | Written by triggers on                                                                                                  | Drain pushes                                                                 |
| --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `summary` | `''`       | `document` insert/update, `document_tabs` insert/update/delete, `tabs` update, `tab_stats` insert/update                | `documents.content_summary`, `documents.saved_at`                            |
| `tab`     | the tab id | `tabs` update, `document_tabs` insert/delete, `sheet_cells` insert/update/delete on a sheet that tab owns or references | collab rows, form link names, search text, tab-scoped link cleanup on delete |
| `cards`   | `''`       | `items` insert/update/delete, `plan_board_statuses` insert/update/delete                                                | `inbox_cards`, card threads in `collab_threads`                              |
| `items`   | `''`       | `items` insert/update/delete                                                                                            | the items' search text (`~items` row)                                        |
| `images`  | `''`       | `image_refs` insert/delete, `document_tabs` insert/delete                                                               | `document_images` (whole set), grants                                        |

A tab's insert and delete key through its `document_tabs` row (a room's tab is its document's alone).

- A trigger re-keys by `DELETE` then `INSERT` of `(kind, key)`, so a key written during a drain gets a new `id`.
- **Scheduling**: after every write `DocumentDb`'s `onWrite` hook (`RoomContent.noteWrite`, skipped while draining)
  sets the drain's deadline `nextFlushAt(now, lastFlushAt) = max(now + FLUSH_IDLE_MS, lastFlushAt + FLUSH_MIN_GAP_MS)`
  and `DocumentRoom.armAlarm` arms the room's one alarm at the earliest deadline of: the drain
  (`RoomContent.deadline`), the facilitator grace and agent presence expiry. The share drain (B4) and upkeep (B5)
  join it when built. A room woken with keys in its outbox drains at once.
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
    `inbox_cards` and `collab_threads` under `~cards` (`CARD_THREADS_TAB`) replaced from `json_each` chunks of
    `readInboxCards` (`inbox-cards.ts`); the `~items` search row (`itemsSearchStatements`: `itemsSearchText` of
    `listItems`, under `ITEMS_SEARCH_KEY`). Logged as `unit=summary`.
  - tab unit (`tabStatements`, parts `TAB_UNIT_PARTS`), tab present: `collabStatements` (delete the tab's
    `collab_threads`/`collab_actions`, insert from `json_each` chunks with `tab_name`); `formLinkStatements` (the
    tab's `form_links` name, heading and board, written only when changed); `searchStatements`, the tab's
    `content_search` row from `tabSearchText` with the inputs of the sheets it references (`sheetSearchInputs`;
    content search blueprint).
  - tab unit, tab gone: the same deletes, the search row's delete, and `goneTabStatements`:
    `DELETE FROM shared_with` and `DELETE FROM share_links WHERE document_id = ? AND tab_id = ?`.
- Each bound JSON value is chunked under `JSON_CHUNK_BYTES` (`jsonChunks`).

### The content summary

```ts
// apps/api/src/db/content-summary.ts
export type ContentSummary = {
  v: 1;
  tabs: number; // how many tabs the document holds
  firstTabCount: number | null; // the first tab's element count, -1 not yet known, null with no tab
  tabCounts: Record<string, number>; // each tab's element count by tab id, -1 not yet known
  stats: DocumentStats | null; // the Details view's columns, null while any tab is uncounted
  hasContent: boolean; // the empty clean-up's test
};
```

- Built by `contentSummaryOf(env, documentId)` (`document-room/content-summary.ts`) in the room, in one batch:
  per tab of `document_tabs` in `order_index` order, `COALESCE(tabs.element_count, -1)` and the empty test
  (`HAS_CONTENT`, the `CASE` the empty clean-up's statement used); and `documentStatsSql` over the room's
  `document_tabs` and `tab_stats`, read through `readDocumentStats`.
- Read in D1 by SQL, never parsed whole on a list: `firstTabCountSql(idSql, scopeTabSql?)` answers -1 when
  `content_summary IS NULL`, else `$.firstTabCount`, or `$.tabCounts.<tab>` for a tab-scoped share's row (Home and
  the shared list); `docStatsSql(idSql)` answers `$.stats`. `rowToSummary` maps the count through `isEmptyCount`,
  so an unknown summary is never `empty`. The empty clean-up reads `$.hasContent`, and image retention pauses on any
  `content_summary IS NULL`.

### Routing

- `index.ts` keeps auth, rate limits, read-only tokens, workbench confinement and body caps.
- `routes/documents.ts` `handleDocuments` splits: `handleDocumentCollection` (`routes/document-collection-route.ts`:
  list, `POST /api/documents`), the realtime admission (`handleDocumentRoomRoutes`: the ticket mint and the
  WebSocket upgrade, through the client's `fetch`) and the copy (`handleDocumentCopy`) stay in the worker; every
  other path `/api/documents/:id/...` (`:id` a document id of at most `MAX_DOCUMENT_ID` characters, else 404) goes to
  `askRoom(request, () => documentRoom(env, id).route(request, identityOf(ctx)))` (`document-client.ts`).
- `documentRoom(env, documentId)` (`document-room/document-client.ts`) is the one place that stubs `DOCUMENT_ROOM`
  (`idFromName(documentId)`). It answers a `DocumentRoomClient`: every RPC with the document id filled in, and a
  `fetch(input, init?)` that sets `X-Document-Id` (`DOCUMENT_ID_HEADER`) on every call, so a room knows whose legacy
  state to take over ([move blueprint](document-storage-move.md), "Room state handover"). Inside the room the same
  call is a plain method call (`localNamespace` in `room-content.ts` answers the room's own id with the room).
- `askRoom(request, call)` answers the room's response, or 503 `room_unavailable` through `roomUnavailable` when the
  call throws (D16).
- In the room, `RoomContent.rpc(documentId)` (`room-content.ts`) is the only way in for an RPC: it binds the id
  (`bind`: adopt it when the room stores nothing, else throw `RoomIdMismatchError` on any other), runs the
  handover gate (the `prepare` hook: `DocumentRoom.prepareForRpc`, the legacy handover, which throws
  `RoomNotReadyError` when it failed), then answers `documentRpc(env, waitUntil)` (`document-rpc.ts`).
- `answerDocumentRequest(env, request, identity, waitUntil)` (`document-route.ts`) rebuilds `RouteContext` with
  `env` widened to `DocumentEnv` and runs `handleDocumentRequest(ctx)`, the existing handler tree.
- `RouteIdentity = { sessionAccountId, verifiedAccountId, accountEmail, sessionAuthTime, owner, token, workbench }`,
  the fields of LiveDoc's `RouteContext`.
- Create (D11): the worker (`handleDocumentCollection`) validates the whole request, then calls
  `documentRoom(env, id).create(seed)` with a `DocumentSeed` (`document-create.ts`: `identity`, `owner`, `recommit`,
  `savedAt`, `createdAt`, `presentation`, `itemTypes`, `tabs`, `items`, `sheets`). The room's
  `createDocumentContent` stores the document row, tabs, items, sheets and deck and answers a `CreateOutcome`:
  `{ ok: true; summary: ContentSummary } | { ok: false; status: number; body: unknown }`, the second the refusal a
  seed store made (logged `[documents] create seed refused`). Then the worker writes the D1 row with
  `content_summary` (`upsertDocumentMeta`). A genuine create whose room throws, refuses or whose D1 write fails
  purges the room again (`purgeRooms`, logged `[documents] create discarded`); a throw answers 503
  `room_unavailable`, a refusal its own status and body. A re-commit of the caller's own id never purges.
- Copy (`POST /api/documents/:id/copy`, `handleDocumentCopy` → `copyDocument`): the source room's
  `exportCopy(onlyTabId, redactAuthorsFor)` answers a `DocumentCopy` (or null) → the worker writes the new D1 row and
  the copy's placement grants (`imageGrantCopyStatements`) in one batch → the target room's `importCopy(copy)` stores
  it under fresh tab ids (`remapTabLinks` on the way) and answers the first summary → the worker writes
  `content_summary`. An import that throws removes the new D1 row (`documentRemovalStatements`), purges the target
  room, logs `[documents] copy import failed` and answers 503 `room_unavailable`; the source is untouched.

### Reads from outside a document's routes

Every call goes through `documentRoom(env, id)`, so the id is bound and not repeated:

| Caller                                                    | Client call                                     | Answers                                                                       |
| --------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| every document read (`getDocument`: share, timeline, ...) | `outline()`                                     | `DocumentOutline`: `{ tabs, presentation, itemTypes, itemTypesRev, savedAt }` |
| image bytes `GET /api/images/:id`                         | `placesImage(imageId, onlyTabId)`               | `boolean`                                                                     |
| snapshot, share card, live image (`routes/share.ts`)      | `image(request, identity)`                      | `Response` (`document-image-request.ts`, in the room)                         |
| public form doors (`routes/forms.ts`)                     | `respondToForm(request, identity)`              | `answerFormRequest` (`routes/forms.ts`), in the room                          |
| workbench ticket (`routes/workbench-ticket-route.ts`)     | `hasTab(tabId)`                                 | `boolean`                                                                     |
| team mention of a card comment (`team-mention-routes.ts`) | `item(itemId)`                                  | `Item \| null`                                                                |
| copy                                                      | `exportCopy(...)`, `importCopy(copy)`           | `DocumentCopy \| null`, `ContentSummary`                                      |
| purge (`room-purge-client.ts` `purgeRooms`)               | `fetch` `POST /purge`, not an RPC               | 2xx once the room deleted its storage                                         |
| shared tabs (not built)                                   | `sharedTabCopy`, `shareJoined`, `receiveShares` | (below)                                                                       |

### Shared tabs (`document-room/tab-shares.ts` (planned))

Plan 0006, phase B4. Until it lands, `POST /api/documents/:id/tabs/:tabId/link` for a tab the document does
not hold answers 501 `tab_link_unavailable`, logged `[tab-link] refused` (`reason: shared_tabs_pending`); a tab it
already holds answers `{ tab }` as before.

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

Built: `purgeRooms(env, ids)` (`room-purge-client.ts`) runs after the D1 removal batch of every purge (the Trash's
purge, Take Offline, deleting an account, a discarded create or copy): `POST /purge` to each room through
`roomFetch`, `ROOM_PURGE_CONCURRENCY` at once, `ROOM_PURGE_TIMEOUT_MS` each, best effort; an unreached room is logged
`[room-purge] did not reach the room` and counted (`[room-purge] purged { rooms, unreached }`). The room's purge closes
every socket (`DOCUMENT_TRASHED_CLOSE`), settles the ledger, `deleteAlarm`, `deleteAll` (the content with it) and
logs `[room] purged`.

Not built yet (plan 0006, phase B5): the tombstones, so until then an unreached room keeps its storage, with no D1 row
that can open it.

- `purgeDocuments(env, ids)` (D1) writes `room_purges (document_id TEXT PRIMARY KEY, requested_at INTEGER NOT NULL,
attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at INTEGER)` rows in the removal batch (the table exists,
  migration `0109_room_purges.sql`; nothing writes it yet), then purges each room as above; a confirmed purge deletes
  its row.
- The daily cron retries at most `ROOM_PURGE_MAX_PER_RUN` rows whose `last_attempt_at` is older than
  `ROOM_PURGE_RETRY_MS`.
- **Guard G3**: the worker answers 404 for a document id with a `room_purges` row, before reaching the room.
- The room's purge leaves every shared tab first (sends now, not queued), once shared tabs exist.

### Upkeep

Not built yet (plan 0006, phase B5). The D1 crons for sheet expiry and changeset retention were removed with the
move, so until the upkeep lands no unreferenced sheet expires and no changeset ages out; nothing is lost, only kept
longer. The tab stats, image reference and collaboration index backfills are removed for good (the move indexes
each document as it lands).

`maintain(now)` from the alarm, at most once per `UPKEEP_INTERVAL_MS` (stored `upkeep_at` key): delete changesets
older than `CHANGESET_RETENTION_DAYS` (the `agent_changeset_parts` cascade); delete sheets unreferenced longer than
the sheet store's 30 days (`runSheetExpiry(env: DocumentEnv, now)`, `sheet-sweep.ts`, already typed on the room's
SQLite and unscheduled until then).

## Interfaces and contracts

- **RPC surface** (`DocumentRoomRpc`, `document-rpc.ts`; `DocumentRoom` methods that each run
  `(await this.content.rpc(documentId)).<method>(...)`; the worker calls them only through `documentRoom(env, id)`):
  `route(documentId, request: Request, identity: RouteIdentity): Promise<Response>`;
  `create(documentId, seed: DocumentSeed): Promise<CreateOutcome>`;
  `outline(documentId): Promise<DocumentOutline>`;
  `hasTab(documentId, tabId): Promise<boolean>`;
  `placesImage(documentId, imageId, onlyTabId: string | null): Promise<boolean>`;
  `image(documentId, request, identity): Promise<Response>`;
  `exportCopy(documentId, onlyTabId: string | null, redactAuthorsFor: string | null): Promise<DocumentCopy | null>`;
  `importCopy(documentId, copy: DocumentCopy): Promise<ContentSummary>`;
  `item(documentId, itemId): Promise<Item | null>`;
  `respondToForm(documentId, request, identity): Promise<Response>`.
  Not built yet (plan 0006, phase B4): `sharedTabCopy(documentId, tabId): Promise<SharedTabCopy | null>`;
  `shareJoined(documentId, tabId, member): Promise<void>`;
  `receiveShares(documentId, messages: ShareMessage[]): Promise<ShareAnswer[]>`.
- `CreateOutcome = { ok: true; summary: ContentSummary } | { ok: false; status: number; body: unknown }`
  (`document-create.ts`).
- Every RPC binds `documentId` first (`RoomContent.bind`): a room that stores nothing adopts it (a create, a copy's
  import, the move); one that stores a document throws `RoomIdMismatchError` for any other id (a programming error,
  logged `[room-route] failed id=<id> path=rpc error=RoomIdMismatchError`).
- The editor's, the MCP server's and the CLI's wire is unchanged; the link route's `{ from }` comes with shared tabs.
- D1 migrations, after `0103_drop_community.sql`:
  1. `0104_content_search.sql`: the content search tables (content search blueprint).
  2. `0105_content_summary.sql`: `documents.content_summary TEXT NULL`.
  3. `0106_collab_by_document.sql`: `collab_threads`, `collab_actions` rebuilt keyed `(document_id, tab_id, ...)`,
     `document_id` FK to `documents` `ON DELETE CASCADE`, `tab_name TEXT NOT NULL`, no FK to `tabs`; rows not
     carried (the first drain after each move refills them).
  4. `0107_inbox_cards.sql`: `inbox_cards (document_id, item_id, item_key, type, title, status, assignee_id,
listed, updated_at, board, boards, PRIMARY KEY (document_id, item_id))`, index `inbox_cards_assignee` on
     `assignee_id` where `listed = 1`, FK `documents` cascade. The room's read is `readInboxCards`
     (`document-room/inbox-cards.ts`): the cards and the card threads the `cards` unit pushes.
  5. `0108_document_images.sql`: `document_images (document_id, image_id, PRIMARY KEY (document_id, image_id))
WITHOUT ROWID`, index on `image_id`, FK `documents` cascade.
  6. `0109_room_purges.sql`: `room_purges` (above).
  7. `0110_form_links_tab.sql`: `form_links.tab_name`, `heading`, `board_tab_id`, pushed with the tab unit
     (`formLinkStatements`).
- D1's content tables (`tabs`, `document_tabs`, `tab_stats`, `image_refs`, `image_refs_backfill`,
  `agent_changesets`, `agent_changeset_parts`, `items`, `sheets`, `sheet_cells`, `sheet_refs`,
  `plan_board_statuses`, `collab_index_state`) are not touched by these migrations; the drop is the move blueprint's.

## Data and persistence

Room schema step 1 (`DOCUMENT_SCHEMA_STEPS[0]`), columns as in D1 today unless named:

| Table                                       | Key                                     | Notes                                                                                                   |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `document`                                  | `id`                                    | `presentation`, `item_types`, `item_types_rev`, `items_rev`, `items_next_key`, `saved_at`, `created_at` |
| `tabs`                                      | `id`                                    | as D1, with the `tab_rev_stale` trigger                                                                 |
| `document_tabs`                             | `(document_id, tab_id)`                 | FKs to `document` and `tabs`, cascade                                                                   |
| `tab_stats`                                 | `tab_id`                                | FK `tabs` cascade                                                                                       |
| `image_refs`                                | `(tab_id, image_id)`                    | FK `tabs` cascade (no table rebuilds here, unlike D1's)                                                 |
| `agent_changesets`                          | `id`                                    | FK `tabs` cascade                                                                                       |
| `agent_changeset_parts`                     | `(changeset_id, part)`                  | FK cascade                                                                                              |
| `items`                                     | `(document_id, id)`                     | as D1                                                                                                   |
| `plan_board_statuses`                       | `(tab_id, status, element_id)`          | FK `tabs` cascade                                                                                       |
| `sheets`, `sheet_cells`, `sheet_refs`       | as D1                                   | FKs within the room                                                                                     |
| `tab_shares`, `share_outbox`, `share_state` | above (B4, not built yet)               |                                                                                                         |
| `outbox`                                    | `id`, unique `(document_id, kind, key)` |                                                                                                         |

- Classification: everything above is **content** (private to the document's readers); `outbox` and
  `share_outbox` are **derived**; the key-value room state is unchanged.
- D1's new rows are **derived** from content and safe to drop and refill: every drain is a full replace.
- Snapshot and restore: a room has Point In Time Recovery (30 days); D1 keeps Time Travel. D1 export does not support
  virtual tables, so an export drops the search tables first and recreates them after.

## Errors and edge cases

| Case                                             | Handling                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Room RPC throws or times out on a document route | 503 `room_unavailable` (`askRoom`), `[room-route] failed id=<id> path=<path> error=<name>` |
| RPC names another document than the room holds   | `RoomIdMismatchError`, logged; 503 through `askRoom`                                       |
| Legacy handover fails before an RPC              | `RoomNotReadyError`; 503 through `askRoom`; the next call retries                          |
| Create: room fails or refuses                    | room purged; 503 `room_unavailable`, or the refusal                                        |
| Create: room stored, D1 insert fails             | room purged; the error answers 500                                                         |
| Copy: target import fails                        | new D1 row deleted; 503; the source is untouched                                           |
| Drain unit fails                                 | its keys stay; retry at `now + FLUSH_RETRY_MS`; `[outbox] unit failed`                     |
| Drain after the D1 row is gone                   | G2 writes nothing; keys deleted                                                            |
| `tab_rev_stale` in a save                        | as today: 409 with the stored rev                                                          |
| Tab over `MAX_TAB_BYTES`                         | as today: 413 `payload_too_large`, nothing written                                         |
| Share send to a holder that is gone              | `gone`: holder deleted, `[tab-shares] holder gone`                                         |
| Two holders write in the same millisecond        | the larger `sha256(data)` wins in both                                                     |
| Link with `from` holding the tab in its Trash    | allowed: a trashed document still holds its tabs                                           |
| Room purge unreached                             | D1 rows gone; `[room-purge] did not reach the room`; tombstone and retry once B5 lands     |
| Stray id wakes a room                            | `empty`; nothing stored (R1)                                                               |
| Summary missing (never pushed)                   | listing `empty: false`; clean-up keeps it                                                  |
| Alarm fires with nothing due                     | re-arms from the remaining deadlines, or none                                              |

## Security and trust

- Only the api Worker holds the `DOCUMENT_ROOM` binding; RPCs are not reachable from the edge. The room trusts
  `RouteIdentity` as it trusted the verified headers before, and re-runs every access check itself.
- Content never crosses into D1 except the derived index rows and search text, which carry nothing a reader of the
  document cannot already read; reads of them are access-filtered.
- `receiveShares` accepts a body only for a tab whose `tab_shares` lists the sender; otherwise `gone`.
- Rate limits and body caps run in the worker before the room, so a room is never the first line against abuse.

## Performance and limits

- Budgets (`document-room-store.test.ts`, node:sqlite as the room's SQLite, CPU time): a 1 MB tab saves under 60 ms
  and reads under 30 ms; a tab placing 500 images saves under 15 ms; a 200-tab outline under 10 ms. Sending a 1 MB
  tab to 20 holders under 2 s in total joins them with shared tabs (B4).
- A drain writes at most `DRAIN_TABS` tab units, each one D1 batch; at most `PUSH_CONCURRENCY` in flight; subrequests
  per drain stay under 60, inside the Durable Object budget.
- Durable Object SQLite: 2 MB per row or value (the tab cap), 10 GB per object; D1 statement limits (100 bound
  parameters, 100 KB of SQL) are met by `json_each` chunks.
- The save path makes no D1 round trip; D1 reads per list page are unchanged in count (the subqueries over `tabs` and
  `tab_stats` become `json_extract`s of the row's own `content_summary`: `firstTabCountSql`, `docStatsSql`).

## Observability

| Fingerprint                                                             | When                    |
| ----------------------------------------------------------------------- | ----------------------- |
| `[room-route] failed id=<id> path=<path> error=<name>`                  | a routed request throws |
| `[room-schema] migrated id=<id> from=<n> to=<m>`                        | a schema step runs      |
| `[outbox] drained id=<id> units=<n> keys=<k> more=<bool>`               | every drain             |
| `[outbox] unit failed id=<id> unit=<summary\|tab:<tabId>> error`        | a unit's batch fails    |
| `[tab-shares] sent id=<id> to=<doc> kind=<k> answer=<a>`                | each share message (B4) |
| `[tab-shares] holder gone id=<id> tab=<tab> holder=<doc>`               | holder `gone` (B4)      |
| `[tab-link] refused { documentId, tabId, reason: shared_tabs_pending }` | link to another's tab   |
| `[room-purge] did not reach the room { documentId, error }`             | a room purge failed     |
| `[room-purge] purged { rooms, unreached }` / `[room] purged`            | each purge call / room  |
| `[documents] create discarded { documentId, why }`                      | a create purged again   |
| `[documents] create seed refused { documentId, status }`                | a seed store refused    |
| `[documents] copy import failed { sourceId, newId, error }`             | a copy's import threw   |
| `[room-upkeep] id=<id> changesets=<n> sheets=<m>`                       | each upkeep run (B5)    |

## Testing

| Rule                                                              | Test                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1 schema on first write only                                     | `document-schema.test.ts`, `document-db.test.ts`                             |
| R2 a throw undoes the call                                        | `document-db.test.ts` (batch rollback)                                       |
| R3 every write path keys the outbox                               | `document-outbox-keys.test.ts`, one case per table                           |
| Drain bounds, retry, re-keyed key survives a drain                | `document-outbox.test.ts`                                                    |
| Drain pace: idle, once a minute, retry after a failed unit        | `room-content.test.ts`                                                       |
| G2 no write after purge                                           | `document-outbox.test.ts`                                                    |
| Summary: counts per tab, stats, unknown counts                    | `content-summary.test.ts`                                                    |
| Routing hands every `/api/documents/:id/` path to the room        | `document-route.test.ts`                                                     |
| One client per document: `X-Document-Id`, ids bound, sole stub    | `document-client.test.ts`                                                    |
| `askRoom` answers 503 `room_unavailable` on a throw               | `document-client.test.ts`, `document-route.test.ts`                          |
| Bind before the handover; mismatch refused; handover gate         | `document-room-handover.test.ts`                                             |
| Access checks unchanged per route                                 | existing route tests, run through the room harness (`test-document-room.ts`) |
| Shared tabs: join, write, later wins, no echo, leave, gone, purge | `tab-shares.test.ts` (B4, not built yet)                                     |
| Link route answers 400/403/404/200                                | `tab-link-route.test.ts` (B4, not built yet)                                 |
| G3 tombstoned id answers 404                                      | `room-purge.test.ts` (B5, not built yet)                                     |
| Upkeep deletes old changesets and sheets                          | `document-room-upkeep.test.ts` (B5, not built yet)                           |
| Budgets                                                           | `document-room-store.test.ts`                                                |
| Inbox reads the pushed rows                                       | `collab-index.test.ts`, `activity-cards.test.ts`                             |

The harnesses, neither a `.test.ts` file:

- `test-sqlite-d1.ts` `sqliteD1(base?, opts?)`: a real SQLite with every D1 migration, D1's content tables dropped
  and every room's tables beside D1's behind `env.DOCUMENT_DB`; a D1 `documents` insert makes its room's `document`
  row; the rooms' outboxes drain (`drainOutbox`) before every D1 call, so a test reads D1 as it is once the drain
  landed; a D1 statement naming a room table throws. `keepD1Content` keeps D1's content tables, with no room tables,
  for the move's tests.
- `test-document-room.ts`: `withTestDocumentRooms(env)` answers `DOCUMENT_ROOM`'s RPCs against the env itself, so a
  route test drives the worker's handler through the room's; `testDocumentRoom(env?)` builds a real `DocumentRoom`
  on a node:sqlite database of its own (`roomSqlStorage`).

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
| `ROOM_PURGE_CONCURRENCY`    | 10         | `purgeRooms` (`room-purge-client.ts`)        | 1 to 20              |
| `ROOM_PURGE_TIMEOUT_MS`     | 3,000      | `purgeRooms` (`room-purge-client.ts`)        | 1,000 to 10,000      |
| `ROOM_PURGE_MAX_PER_RUN`    | 300        | upstream index purge                         | 50 to 1,000          |
| `ROOM_PURGE_RETRY_MS`       | 3,600,000  | upstream index purge ("once an hour")        | 600,000 and up       |
| `UPKEEP_INTERVAL_MS`        | 86,400,000 | the daily crons it replaces                  | 3,600,000 and up     |
| `SQLITE_ROW_MAX_BYTES`      | 2,000,000  | Durable Object SQLite limit                  | fixed                |
| `SQLITE_ROW_HEADROOM_BYTES` | 8,192      | the tab row's other columns and header       | fixed                |

`SHARE_DRAIN_MAX` (B4), `ROOM_PURGE_MAX_PER_RUN`, `ROOM_PURGE_RETRY_MS` and `UPKEEP_INTERVAL_MS` (B5) are not in the code
yet; the rest are, the drain's pace in `room-content.ts` and its bounds in `document-outbox.ts`.
`SQLITE_ROW_MAX_BYTES` and `SQLITE_ROW_HEADROOM_BYTES` live in `@livedoc/api-schema` (`tab-size.ts`); `MAX_TAB_BYTES`
is their difference, 1,991,808.
`wrangler.toml`: the class migration is the move blueprint's; no new binding here.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D7 to D16.
