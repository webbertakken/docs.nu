# Tab folders

## Why

A document's tabs are a flat, ordered list in the tab list ([Toolbar layout](../007-editor/toolbar-layout.md#the-tab-list)). Once a document grows past a handful of tabs that list gets unwieldy. Users want to group related tabs into a named **folder**, e.g. put three tabs under "Organisation" and two under "Plans", that takes one chip of space on the bar when they're not using it.

This is the editor's tab list only. It is unrelated to [Folders](../013-workspace/folders.md), which nests **documents** in the Explorer.

## Scope

- **One level.** A folder contains tabs; folders never contain folders.
- **Per-document.** Tab order already lives on the `document_tabs` link, not on the shared `tabs` row, because a tab can be shared into several documents ([Tab ↔ document many-to-many](tab-document-many-to-many.md)). Folder membership lives in the same place, for the same reason: a tab shared into two documents can sit in a folder in one and be loose in the other. Folder membership is **never** part of the tab body (`tabs.data`).
- **Identified by name.** There is no folder entity or table. A folder _is_ a name string. It exists as long as at least one tab in the document carries that name; it disappears when the last member leaves. Renaming a folder = rewriting the name on every member.

## Data model

Migration `0018` adds one nullable column to the link table from [Tab ↔ document many-to-many](tab-document-many-to-many.md):

```sql
ALTER TABLE document_tabs ADD COLUMN folder TEXT;  -- NULL = loose (no folder)
```

No backfill (every existing tab is loose), no index (folders are derived by a client-side scan over the already-ordered read). The column is intentionally **not** mirrored onto the legacy `tabs` table the way `order_index` is (migration 0011) — folder membership is a document-link concept with no legacy equivalent.

## Ordering: one flat list, folders are contiguous runs

There is **one** per-document order (the existing `document_tabs.order_index`). A folder is a **maximal run of adjacent tabs that share a folder name**, drawn under one heading. There is no second ordering dimension and no per-folder order.

To keep that invariant true after any reorder or membership change, the client **normalizes** the order before persisting:

> Stable-sort the tabs by the key `(folderAnchorIndex, originalIndex)`, where `folderAnchorIndex` is the minimum original index among all tabs sharing that (non-empty) folder name. Loose tabs anchor on their own index.

This groups every folder's tabs at the position of the folder's first member, preserves each tab's order within its folder, and interleaves loose tabs by position. Normalization is idempotent and preserves tab object identity for tabs whose content did not change (so the autosave content diff doesn't spuriously re-save bodies). The single implementation lives in `packages/document/src/tab-folders.ts` (`normalizeFolderOrder`, `groupTabsIntoRuns`, `folderNamesInDocument`) and is consumed by the tab list's renderer, the client save path, and the server route (defensive).

A drag both reorders AND sets membership: the dropped tab **adopts the drop target's folder** (see "Membership UX" below), then normalization re-groups the runs. So dragging never "snaps back" — it moves the tab to wherever it was dropped, in or out of a folder.

## Membership UX

Folder membership changes two ways:

**1. Drag and drop.** Dropping a tab onto a folder's rows (or onto the folder heading, which targets the run's first member) **joins** that folder; dropping it among loose tabs makes it **loose**; dropping it among a different folder's rows **moves** it there. The tab simply adopts the drop target's folder. `reorderTabs` performs the membership change in the same commit as the reorder.

**Drop position is deterministic + shown.** While dragging, the tab list reads the pointer's position within the hovered row: the upper half means "land **before** this tab", the lower half means "land **after**", and an **insertion caret** renders in that exact gap so the user can see where the tab will go before releasing. `reorderTabs` takes a `placeBefore` flag (set from that side) and recomputes the target index _after_ removing the source, so the result matches the caret regardless of drag direction. (Dropping onto a folder heading omits the flag and joins at the run's head, as above.) Before this, the only cue was a highlight ring around the whole target and the landing side flipped with drag direction, so the drop was hard to predict.

**2. The tab's right-click / ellipsis menu** — an **Add to Folder** row that opens a centred **modal** (`AddTabToFolderDialog`, the same tile-grid language as the shared placement browser, [Folders](../013-workspace/folders.md)), replacing the old cramped in-menu sub-view. Picking commits immediately and closes:

- **A tile per existing folder** in this document → move the active tab into it (the current folder's tile reads "Current" and is a no-op).
- **A "No Folder" tile** → makes the tab loose on the bar; selected when the tab already is.
- **A "New Folder" tile** → create-in-place naming (the placement browser's dashed tile); typing an existing name just moves the tab into it (same name = same folder).

## Tab list rendering

The tab list ([Toolbar layout](../007-editor/toolbar-layout.md#the-tab-list)) maps over `groupTabsIntoRuns(tabs)` instead of the flat list:

- **Loose** entries render a row: the tab's kind glyph, its name (cut short with an ellipsis) and the presence stack of who is on it. The **active** tab's row is tinted and carries its tab menu (⋯).
- **Folder** entries render as a **heading** (a folder glyph, the folder **name** and the member count), with the members' rows indented under it, each a row as a loose tab's is (selection, presence, drag-reorder, tab menu). Nothing about a folder's display is stored or broadcast.
- Double-clicking a heading renames the folder (rewrites every member).

## Persistence & realtime

Folder rides the **same wire path as `orderIndex`**, never the per-tab content `PUT`:

- `PUT /api/documents/:id` body widens from `{ name?, tabIds? }` to also accept `{ tabs?: { id, folder? }[] }`. New clients send `tabs` (order = array position, plus folder); the server falls back to `tabIds` (folder null) for older clients. Empty/whitespace folder names are trimmed to NULL server-side. An entry that is neither a tab id nor `{ id, folder? }` with a text or null folder refuses the whole request (400 `invalid tabs`) before anything is written, the rename included.
- The `document-meta` room op's `tabs` entries widen to `{ id, name, orderIndex, folder? }` so a peer's folder change applies live. `folder` is optional throughout, so an older peer/client omitting it is treated as loose — no parse break.
- `reorderTabs` writes `document_tabs.folder` alongside `order_index`. The per-tab content upsert (`upsertTab`) leaves `document_tabs.folder` untouched, so a content save can never clobber membership.
- The persisted tab body strips `folder` (centralised with `templateChosen` in `stripUiTabFields`), so folder never leaks into the shared `tabs.data`.

## Telemetry

Reuses the closed vocabulary ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) with **the subject deciding the category**, and every event carries a `type` so none of it collides with tab lifecycle:

| What Happened                   | Event                |
| ------------------------------- | -------------------- |
| A tab was filed into a folder   | `Tab·Moved·Folder`   |
| A tab was taken out of a folder | `Tab·Removed·Folder` |
| A folder came into existence    | `Folder·Created·Tab` |
| A folder was renamed            | `Folder·Renamed·Tab` |

The folder **name is user content** and is never sent as the `type` argument — the `Tab` type on the `Folder` events distinguishes a tab folder from an explorer folder of documents, nothing more.

The `type` is not decoration. A dashboard metric card selects rows by an exact `type` match and `null` is a value, so the original untyped spelling of this table (`Tab·Created` for a new folder, `Tab·Renamed` for a folder rename) landed folder operations in the headline "Tabs Created" and "Tabs Renamed" cards, inflating a count of tabs with a count of folders.

Two further rules, both learned from the untyped version:

- **A new folder emits two events**, `Folder·Created·Tab` then `Tab·Moved·Folder`, because typing a name the document hasn't used is genuinely two facts (the folder exists; this tab is in it). Emitting only the creation made "tabs filed into folders" undercount by exactly the number of folders anyone created. Listed with the other deliberate double-emits in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md).
- **The menu and the drag report identically.** Membership can change either from the ellipsis menu or from a drag that adopts the drop target's folder, and the two had drifted: leaving a folder by menu counted as `Tab·Removed`, leaving it by drag counted as `Tab·Reordered`. Which control someone reached for is not the fact being measured, so both paths go through one module (`hooks/persistence/tab-folder-reporting.ts`). A drag that crosses a folder boundary reports the membership change and **not** the reorder it came with; `Tab·Reordered` now means a reorder that changed nothing else.

## Edge cases

- **Active tab in a folder** → its row is tinted under its folder's heading, and the document group's active tab segment names it, so the user can always see where they are.
- **One-tab folder** → valid; renders as a heading with one row.
- **Empty/whitespace name** → treated as loose everywhere (client normalize, create handler rejects, server trims to NULL).
- **Name uniqueness within a document** → same name is the same folder (members merge into one run on normalize).
- **Shared tab, foldered in A, loose in B** → naturally correct: folder is on the link, never in the body.

## Cross-references

- [Per-tab storage](per-tab-storage.md) — per-tab storage; folder is link metadata, not body content.
- [Tab ↔ document many-to-many](tab-document-many-to-many.md) — the `document_tabs` link table folder now extends.
- [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) — telemetry enums reused here.
