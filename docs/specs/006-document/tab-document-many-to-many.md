# Tab ↔ document many-to-many

## Why

Originally every `tabs` row carried a single `document_id` FK — one tab belonged to one document. That worked for the editor's "tabs are folders inside a document" mental model, but it forecloses a category of features the user has flagged for the next phase:

- **Copy a tab between documents** without duplicating the content (so an edit in one tab propagates to the other).
- **A reference tab** that lives in several documents at once — e.g. a glossary, a shared timeline, an architecture diagram that's part of two product lines' workspaces.
- **Change log without per-document scoping** (paired with item #14; the change log itself was removed on 2026-10-03, see [Collaboration](../012-collaboration/README.md)): once a tab can live in multiple documents, attributing a change to a single `(document_id, tab_id)` pair stops being meaningful. The change should be on the tab; consumers join through the link table when they care which documents it surfaces in.

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.document_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron. (Migration 0064 later dropped `change_log` outright along with the Activity panel.)

## Data model

Each document's content lives in its own room ([Document storage](document-storage.md)), so a tab in two documents
is a tab in two rooms.
Every document holding a shared tab keeps its own copy of it under the same tab id, lists the other holders, and the
holders keep their copies in step.

In each room's SQLite:

- `tabs` holds the body ([Per-tab storage](per-tab-storage.md)), with no pointer to any document.
- `document_tabs` holds the tab's place in this document: `order_index`, `added_at` and the per-document `folder`
  ([Tab folders](tab-folders.md)), so each document orders and files a shared tab its own way.
- `tab_shares` lists, per shared tab, the **other** documents holding it.
- `share_outbox` holds what this document still owes the other holders: a tab's body, a join, a leave.

A **holder** is a document holding a shared tab; a **shared tab** is a tab with at least one other holder.

### Keeping the copies in step

- **A write** to a shared tab (a save, a rename, a Q&A board vote, an agent's changeset, a comment through the api)
  queues a `body` send to every other holder, from a trigger on `tabs`, so no write path can forget it.
- **Sent when quiet.** The room's alarm sends the queue a few seconds after the document goes quiet, each send a call
  to the holder's room carrying the tab's name and body, its write time and the holders the sender knows.
  It is not held to the D1 push's once a minute: it is a call between rooms, not a D1 write.
- **The later write wins.** A holder takes a body only when it is later than its own copy, by write time, then (two
  writes in the same millisecond) by content, so every holder settles on the same one.
  A copy taken in updates the tab's stats, image references and outbox as a local write does.
- **No echo.** A holder taking a copy sends it on only to holders the sender did not list; that is also how a holder
  that joined a moment ago hears of a write made by one that has not yet heard of it.
- **Joining.** Tab ids are unique per document only, so Add to Document refuses a target that already holds an
  unrelated tab with that id (409 `tab_id_taken`).
  Add to Document runs in the target's room: it reads the tab and its holders from the document it was
  added from, stores the copy at the end of the target's tab order, then has the source record the join.
  The source lists the target, tells the other holders, and sends the target the tab again if it changed meanwhile.
- **Leaving.** Removing the tab from one document tells the other holders and drops nothing of theirs.
- **Purging.** Purging a document (the [Trash](../013-workspace/trash.md)'s purge, Take Offline, deleting an
  account) tells each holder of each of its shared tabs first.
- **Gone.** A holder that no longer holds the tab, or no longer exists, answers `gone` when next sent it, and is
  dropped then; so a missed leave heals on the next write.
- **Trash.** Trashing a document changes none of this: its shared tabs stay in step until it is purged.
- **Failures.** A send that fails stays queued and is tried again a minute later.
- **Not realtime across documents.** A document open in another window shows another holder's write on reload, as it
  always did.

A tab with Plan content or a Sheet is never added to another document
([Working in Plan](../026-plan/plan-mode.md), [Sheet](../029-sheets/sheet.md)), so items and sheets are never shared.

### Tab lifecycle

- **Create tab**: a `tabs` row and a `document_tabs` row in the document's room.
- **Add tab to another document**: joining, above.
- **Remove tab from a document**: its rows in that room go, with its stats, image references and changesets; the
  other holders are told and keep theirs.
- **Delete a document**: the [Trash](../013-workspace/trash.md); purging it is leaving for every shared tab, then
  the room deletes everything it stores.

### Shared-tab notice

A **shared tab** is a tab linked into more than one document. Removing a document is safe for its shared tabs, but the user cannot see that from the document alone, so the Take Offline confirmation says it first. (A delete asks nothing: it goes to the Trash with an Undo, and a restore brings back the document's links to its tabs.) `GET /api/documents/:id/shared-tabs` answers `{ sharedTabs: { tabs, documents } }`: how many of the document's tabs other documents also hold, and how many distinct other documents, read from its room's tab shares. It answers exactly the callers who may delete the document (owner, or a joined member of its team; `mayDeleteDocument`), in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

The confirmation reads the counts before it opens (`fetchSharedTabsNotice`, `apps/live/lib/shared-tabs-notice.ts`) and, when `tabs` is above zero, adds one sentence:

- **Take Offline** ([Offline Mode](offline-mode.md)): _"2 of its tabs are also used in 1 other document; they stay there, and the copies in this browser no longer share edits with them."_

Singular forms read _"1 of its tabs is ... it stays there"_ and _"1 other document"_. An offline document has no shared tabs and makes no request. The read waits at most `SHARED_TABS_NOTICE_TIMEOUT_MS` (1500 ms); when it fails or runs out of time the confirmation opens without the sentence (the api client reports the failure), since the server keeps shared tabs either way and the notice is information, not the safeguard. The counts are read before the dialog renders so its content never changes under the pointer.

## API impact

- `GET /api/documents/:id` lists the document's tabs from its room, in its `document_tabs` order.
- `PUT /api/documents/:id/tabs/:tabId` writes the copy in this document's room; the outbox carries it to the others.
- `POST /api/documents/:id/tabs/:tabId/link` with `{ from }` adds the tab from `from` into the target `:id`.
  Idempotent: a repeat answers the tab as the target holds it.
  The caller must own the target and `from`, and `from` must hold the tab: 403 otherwise, 404 for a tab or `from`
  that is not there, 400 with no `from` or with `from` the target itself.
  It answers `{ tab }`, the summary of the tab as the target now holds it.
- The tab menu's **Add to Document** row opens a centred modal (`AddTabToDocumentDialog`): a filterable tile grid of
  the caller's other documents, each tile the destination's cached snapshot preview
  ([Document SVG snapshots](document-snapshots.md)) over its name; picking one calls the link with this document as
  `from`.
  Because only the document's owner can link, the row offers no destinations, and so is disabled, on a document the
  caller doesn't own, in an offline document and in a workbench (`addToDocumentTargets`,
  `apps/live/lib/add-to-document-targets.ts`); it never offers a call that can only fail.
- `DELETE /api/documents/:id/tabs/:tabId` removes the tab from this document only; the other holders keep theirs.
- `POST /api/documents/:id/copy` copies the tab bodies into fresh tabs of the new document, shared with nothing, in
  one transaction in the new document's room, and re-points any tab or element link, and any Tab Window's tab, from
  the source tab id to its copy's (`remapTabLinks`, `@livedoc/document`).
  Copy is independent content; link is shared content.

## Phasing

This spec describes the destination. The implementation lands in stages so each can be tested in isolation:

1. **Migration 0011** — add `document_tabs`, backfill from `tabs.document_id` / `tabs.order_index`. Reads go through the link table; writes update both the link table AND the legacy columns. No surface change.
2. **Item #14 — drop `change_log.document_id`** — change_log entries already key by `tab_id`; the `document_id` was just denormalisation. Migration drops the column, queries that filtered by `document_id` now derive the document set via `document_tabs`.
3. **Item #15 — drop denormalised participant metadata from `change_log`** — `participant_name` and `participant_color` columns were copy-on-write snapshots for offline-friendly reads. Drop and join through `participants` on read instead.
4. **Item #16 — 90-day `change_log` cron** — daily worker cron deletes `change_log` rows older than 90 days. Capacity guard against unbounded growth as collab traffic ramps up.
5. **Migration 0049 — drop `tabs.document_id` + `tabs.order_index`.** A table rebuild; `tabs` is a parent table, so the migration parks and restores every `document_tabs`, `change_log` and collaboration-index row across the drop. Document deletion became link-aware first ("Delete a document" above), since with the column gone nothing else removes a tab its last document leaves behind.
6. **Content into rooms** ([Document storage](document-storage.md)): each document's tabs move into its own room;
   a tab in two documents becomes a copy in each, kept in step between the rooms (above).

## Cross-references

- [API app](../015-api/api.md) — endpoint dispatch + the underlying schema overview. Updated alongside the migration in #13.
- [Per-tab storage](per-tab-storage.md) — the per-tab storage rationale. Still applies; the link table is orthogonal to where the tab body lives.
- [Document storage](document-storage.md) — the room each document's tabs live in.
