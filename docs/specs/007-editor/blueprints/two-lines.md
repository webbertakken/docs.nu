# Two lines blueprint

Derived from [Toolbar layout](../toolbar-layout.md) "The two lines" and [Toolbar group](../../004-interface-design/toolbar-group.md).
The look of a group is the [toolbar group blueprint](../../004-interface-design/blueprints/toolbar-group.md); this
blueprint places the groups and says what each holds.

## Domain and naming

| Term (spec)           | Identifier                                                       | File (`apps/live/components/`)          |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| the top line          | the canvas chrome's top row (no component of its own)            | `canvas/CanvasChrome.tsx` places it     |
| the bottom line       | `BottomLine`                                                     | `chrome/lines/BottomLine.tsx`           |
| the brand group       | `BrandGroup`                                                     | `chrome/lines/BrandGroup.tsx`           |
| Back (caret and mark) | `BrandBack`                                                      | `chrome/lines/BrandBack.tsx`            |
| the menu button       | `ToolbarExplorerButton` (the ☰ alone)                           | `chrome/ToolbarExplorerButton.tsx`      |
| the actions group     | `ActionsGroup`                                                   | `chrome/lines/ActionsGroup.tsx`         |
| the document actions  | `DocumentActions` (Copy, Present, Share or Share Form)           | `chrome/lines/DocumentActions.tsx`      |
| the tools group       | the `data-zoom-cluster` box, drawn as a `ToolbarGroup`           | `canvas/CanvasChrome.tsx`               |
| the document group    | `DocumentGroup`                                                  | `chrome/lines/DocumentGroup.tsx`        |
| the document's name   | `DocumentName` (share-state icon, name, role pill)               | `chrome/lines/DocumentName.tsx`         |
| the active tab        | `ActiveTabSegment`                                               | `chrome/lines/ActiveTabSegment.tsx`     |
| the tab stack         | `TabStackButton`                                                 | `chrome/lines/TabListButtons.tsx`       |
| the contributors      | `ContributorsButton`                                             | `chrome/lines/TabListButtons.tsx`       |
| the tab list          | `TabList` (popover), `TabListRow`, `TabListFolder`               | `chrome/lines/TabList*.tsx`             |
| what the lines need   | `EditorLinesContext` (`actions`, `document` nodes from the page) | `chrome/lines/editor-lines-context.tsx` |

`EditorHeader` and `TabBar` are retired: their parts move into the groups above, their tests with them. `TabPill`,
`TabFolderChip` and `OutOfScopeTabPill` go with the tab bar; their behaviour (select, rename, drag to reorder, folder,
presence, the tab menu, out of scope) is the tab list's. `TabPresenceStack`, `EllipsisMenuButton`, `TabPortalMenu`,
`useTabReorderDrag`, `SharedBadge`, `RolePill`, `RoleStatusIcon`, `AuthControls`, `ChromeControls`,
`WorkbenchOpenLink` and `NameEditor` are reused as they are.

## Behaviour and state

### Where each group is drawn

- The editor column holds no header and no footer: `EditorView` passes `SplitViewFrame` neither, and the canvas
  runs the full height (`h-dvh`). The page builds the actions group's and the document group's contents and hands
  them to the canvas chrome through `EditorLinesContext`, so `CanvasChrome` places every group and measures them
  together, and no group's props run through `Canvas`.
- Top line, inside the canvas box: the brand group at `left-3 top-3` (`ToolbarMenuCard`, `data-toolbar-menu`), the
  Palette strip or Draw's top dock centred as now, the actions group at `right-3 top-3` (`data-toolbar-actions`).
- Bottom line (`BottomLine`): one box, `absolute inset-x-3 bottom-3`, `flex flex-wrap-reverse items-end gap-2`,
  holding the tools group first and the document group last (`ml-auto`). Draw's bottom dock is centred on the same
  line by its own positioning (`bottom-3`).
- Corner stacks: the top corners start at `toolbarTopClearancePx` always (the top line is always there), one more
  row when the strip takes a row of its own; `bottom-left` and `bottom-right` start above the bottom line
  (`cornerBottomInset`, measured from the line's own height, so a wrapped line lifts them too).

### What hides each group

| State                           | Brand group | Actions group             | Tools group        | Document group |
| ------------------------------- | ----------- | ------------------------- | ------------------ | -------------- |
| Editing                         | shown       | shown                     | shown              | shown          |
| Welcome flow (`anyWelcomeOpen`) | shown       | the account control alone | as now (none)      | not drawn      |
| Zen                             | not drawn   | not drawn                 | Zoom alone, as now | not drawn      |
| Presenting                      | not drawn   | not drawn                 | not drawn          | not drawn      |
| Embed (`embedMode`)             | not drawn   | not drawn                 | as now             | not drawn      |
| Phone held sideways, folded     | shown       | not drawn                 | shown              | not drawn      |

### The brand group

- `BrandBack`: an `<a>` to `EXPLORER_LANDING_PATH` (in a workbench frame, a `<button>` calling the frame's
  `back`), the caret (`BACK_CARET`) then `Brand` with `wordmark={false}`, `size` 24 px, `accentColor` the tab
  theme's stroke (as the header's did). Accessible name "Back to the Explorer" ("Back" in a frame), with a hover
  card of the same title. A frame with document scope (`workbenchBack` absent but `workbench` present): the mark
  alone in a `<span>`, no caret, not focusable.
- Then `ToolbarDivider`, the ☰ (`ToolbarExplorerButton`, unchanged), and `EditorModeSwitch` (named; its icon alone on
  a phone).
- The tab's name leaves the box: `TabNameInBox` is deleted, `MenuNameSlot` moves into `ActiveTabSegment`.
- `WorkbenchBackButton` is deleted; its `back` and `backTitle` ride on `BrandBack`.

### The actions group

`ChromeControls` (Search, Settings, appearance; `tour={false}`, `labelled` per Button Labels), a divider, then the
`TourOfferButton`, `DocumentActions`, and in a workbench frame `WorkbenchOpenLink`, then `AuthControls`. A divider is
drawn only between two parts that both render (`ToolbarGroup` parts, see the group blueprint).

### The document group

1. `DocumentName`: `SharedBadge look="icon"`, the name (a `HoverCard` "Rename document" button opening `NameEditor`
   for someone who may; plain text otherwise), the role pill (or under Minimal chrome `RoleStatusIcon`). The name
   is `truncate` with `max-width` from the line's room (see "When a line runs out of room"), never under
   `DOC_NAME_MIN_PX`. On a phone the name is not drawn; the icon and pill stay.
2. `ActiveTabSegment`: the tab's `TabModeIcon` in its legible accent, the lock glyph when locked, `MenuNameSlot`
   (a covering board's or Sheet's title portals there), the tab's name, then `EllipsisMenuButton` for someone who may
   change the tabs. Tinted: `bg-slate-100` (`dark:bg-slate-800`) and an inset 1 px ring of the accent at 45%. A click
   on the name renames in place for someone who may (the `active-tab-name-store` rename); a double-click does too.
   Keeps `data-tour-id="active-tab"`.
3. `TabStackButton`: the stack glyph and the count (`tabsInScope.length`), `aria-haspopup="menu"`,
   `aria-expanded`, name "All tabs (n)". Always drawn.
4. `ContributorsButton`: up to `CONTRIBUTORS_SHOWN` avatars of the remote people present (agents folded as the
   presence rows fold them), then "+N"; name "n people here". Not drawn while nobody else is here.
5. Add tab (+, `data-tour-id="add-tab"`, name "Add tab") for someone who may add tabs.

### The tab list

- One open at a time, state in `DocumentGroup`: `openFrom: 'stack' | 'people' | null`. Opening from one button
  while open from the other moves it there.
- A popover in the menu surface, `TAB_LIST_WIDTH_PX` wide, hung `TAB_LIST_GAP_PX` above the button that opened it
  with its arrow at that button, clamped `TAB_LIST_EDGE_PX` inside the canvas (`clampToViewport`), max height the room
  above the button less the edge, its rows scrolling.
- Header "Tabs · n" and, when anyone else is here, "n people here". Filter field "Find a tab" above
  `TAB_LIST_FILTER_FROM` tabs; the query narrows rows by name (case-insensitive, `includes`), folders whose tabs all
  drop are dropped; nothing matching shows "No tab matches".
- Rows: `groupTabsIntoRuns(tabs)`; a folder heading (folder glyph, name, count; double-click renames for someone who
  may, `TabFolderChip`'s rename) with its tabs indented; each tab row: `TabModeIcon`, lock glyph, name (truncated),
  `TabPresenceStack` (its avatars open the Collaborators modal), and on the active row `EllipsisMenuButton`. An
  out-of-scope tab is a "Not shared" row (`OutOfScopeTabPill`'s copy), not switchable.
- Pressing a row: `onSelect(tab.id)`, the list closes, focus returns to the button that opened it.
- Rename: a double-click on a row (someone who may) swaps the name for `NameEditor`; Enter or blur commits,
  Escape cancels and keeps the list open.
- Reorder: rows are `draggable` for someone who may, through `useTabReorderDrag` (its caret drawn as a horizontal
  rule above or below the row); a row dropped on a folder heading joins the folder (`onMoveTabToFolder`), one dragged
  out of its folder's rows leaves it (`onRemoveTabFromFolder`).
- Right-click on a row opens the tab menu for that tab (switching to it first), as the tab pill did.
- Footer: "+ New Tab" for someone who may add tabs; it adds, closes the list and focuses nothing else.
- Keyboard (a menu, [Menus](../../004-interface-design/menus.md)): opening puts focus on the active row (or the filter
  when shown); ArrowDown / ArrowUp walk the rows (and the filter, and New Tab), Home / End jump, Enter or Space
  switch, F2 renames the focused row for someone who may, Escape closes and returns focus to the opener; Tab moves
  out and closes it. Outside press closes it.
- The canvas right-click tab menu (`canvasMenu`) is drawn by `DocumentGroup` now, with the same `tabMenuProps`.

## Interfaces and contracts

- `EditorLinesContext`: `{ actions: ReactNode; document: ReactNode; foldable: boolean }`; `null` outside the editor
  page (an embed, a test), where the chrome draws neither group.
- `DocumentGroup` takes the tab props `TabBar` took (minus `onOpenSettings`, `onOpenSearch`, `workbenchLink`,
  `powerUser`) plus the document-name props `EditorHeader` took (`documentName`, `shareable`, `teamDocument`,
  `offline`, `showShare`, `onOpenShare`, `onRename`, `renameNonce`, `readOnly`, `rolePill`).
- `ActionsGroup` takes `ChromeControls`' props and `DocumentActions`' (`onMakeCopy`, `copying`, `present`, `showShare`,
  `shareable`, `onOpenShare`), `onOpenAccount`, `workbenchOpenHref`, `documentActions` (false through the welcome flow).
- `BrandBack`: `{ href?: string; onBack?: () => void; label: string; accent?: string }`; neither `href` nor `onBack`
  draws the mark alone.

## Share roles

| Control                      | Editor                                          | Participant                  | Viewer                  |
| ---------------------------- | ----------------------------------------------- | ---------------------------- | ----------------------- |
| Back                         | shown                                           | shown                        | shown                   |
| ☰ (Explorer)                | shown                                           | shown                        | shown                   |
| Mode switch                  | shown (`editorMode.canEdit`)                    | not drawn                    | not drawn               |
| Search, Settings, appearance | shown                                           | shown                        | shown                   |
| Start Tour                   | while offered                                   | while offered                | while offered           |
| Copy                         | a visitor (`!canShareDocument`)                 | a visitor                    | a visitor               |
| Present                      | shown with slides                               | shown with slides            | shown with slides       |
| Share / Share Form           | the owner or a team member (`canShareDocument`) | not drawn                    | not drawn               |
| Account                      | shown                                           | shown                        | shown                   |
| Share-state icon             | manages sharing (`showShare`)                   | shows state only             | shows state only        |
| Document name                | renames                                         | text (`isStructureReadOnly`) | text                    |
| Role pill                    | shown                                           | shown                        | shown                   |
| Active tab                   | renames, tab menu                               | name only, no menu           | name only, no menu      |
| Tab stack, tab list          | shown; rows reorder, rename, menu               | shown; rows switch only      | shown; rows switch only |
| Contributors                 | shown while others here                         | shown while others here      | shown while others here |
| Add tab, New Tab             | shown                                           | not drawn                    | not drawn               |

Gates read `can` / `isStructureReadOnly` and `canShareDocument` as the header and tab bar did, never `isReadOnly`
alone ([gate a feature by share role](../../../instructions/gate-a-feature-by-share-role.md)).

## Security and trust

- The groups add no new action: each control keeps the gate it had in the header or the tab bar (Share Roles above),
  and the server still refuses what the session may not do. The tab list draws names and presence the session already
  holds; out-of-scope tabs show no name ("Not shared").
- Back is a same-origin link (`EXPLORER_LANDING_PATH`) or the frame's own `back`; nothing navigates to a URL from
  document content.

## Errors and edge cases

- One tab: the stack shows "1"; the list holds one row.
- A tab-scoped session: the stack counts the tabs in scope; out-of-scope rows show "Not shared".
- The active tab deleted while the list is open: the list re-renders on the new active tab; it stays open.
- The opener unmounts while the list is open (contributors leave): the list closes.
- A rename begun from the command palette (`renameTabNonce`) opens the active segment's rename; `renameDocumentNonce`
  the document name's.
- A long tab name: the active segment never shortens; the document name gives way first, then the strip.

## Performance and limits

- The tab list mounts only while open. The rows are plain buttons, no virtualisation: documents carry at most
  `MAX_TABS` tabs ([Tabs](../../006-document/tabs.md)), well under what a scrolling menu draws in a frame.
- `ContributorsButton` reads the presence map the presence rows already fold; no extra subscription.

## Presentation and UX

- Copy: "Back to the Explorer", "Back", "Tabs", "n people here" ("1 person here"), "Find a tab", "No tab matches",
  "New Tab", "All tabs (n)", "Add tab", "Not shared".
- Every group is a [toolbar group](../../004-interface-design/toolbar-group.md); nothing else draws a card on the lines.

### When a line runs out of room

- The document name's `max-width` is the room the bottom line leaves it: `useLineRoom` measures the line box, the
  tools group and Draw's bottom dock (when drawn) and sets `--doc-name-max` on the document group, floored at
  `DOC_NAME_MIN_PX`.
- The strip's clearance on both sides is `topLineClearance(view)`: the larger of the brand group's right edge and the
  actions group's left edge from the canvas's sides, plus `MENU_GAP_PX` (`useStripCrowded`, `useStripTileLimit`,
  `useBarLabels`, `useMenuCardClearance` read it, so tiles drop first).
- When the strip at its fewest tiles still does not fit, it drops to its own row, top `toolbarTopClearancePx`
  (`data-strip-row="own"`), and the top corner stacks start one row lower. Draw's dock at the top does the same; at
  the bottom it rises one row (`bottom` = the line's height + 8 px) when the line has no room for it between the
  groups.
- Phone: the strip always takes its own row under the top line (no menu card in the strip's row); the bottom line
  wraps, the document group above the tools group.

## Accessibility

- The tab list is a control menu ([Menus blueprint](../../004-interface-design/blueprints/menus.md)): `useControlMenu`
  (`role="dialog"`, `aria-label="Tabs"`, `data-menu-surface="control"`), since it holds a filter field and rename
  fields beside its rows; its triggers use `useMenuButton`. The rows are a `role="list"` of `role="listitem"`s,
  each a button (the active one `aria-current="page"`); folder headings are text, their counts `aria-hidden`. The
  arrow keys move a roving focus over the rows. Focus returns to the opener on close.
- `TabStackButton` / `ContributorsButton`: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` the list id.
- Every button keeps a 44 px touch target (`touch-target`) and a visible focus ring; contrast as the palette strip
  (the same tokens).
- Motion: the list fades in with `animate-fade-in`, none under reduced motion.

## Web Experience

- Zero layout shift ([Layout stability](../../004-interface-design/layout-stability.md)): the tab stack is always
  drawn; the contributors' button appears beside it, never moving the active tab or the name (it sits after them);
  the tab list is a popover; fonts are the chrome's.
- No group delays the canvas's first paint: the groups are part of the chrome chunk already loaded; the tab list's
  code loads on first open (`next/dynamic`).

## Observability

- `track('UI', 'Opened', 'TabListStack')` / `'TabListPeople'` when the list opens; `track('Tab', 'Selected',
'TabList')` on a row switch (reusing the tab events the bar fired); the Back link `track('UI', 'Opened',
'BrandBack')`.
- A tab list row whose tab is gone on press logs `console.warn('[tab-list] row for a missing tab', …)` and closes.

## Testing

| Rule                                                  | Test                                               |
| ----------------------------------------------------- | -------------------------------------------------- |
| Back links to the Explorer, mark only, caret          | `chrome/lines/BrandBack.test.tsx`                  |
| Back in a frame calls back; doc scope draws no link   | `chrome/lines/BrandBack.test.tsx`                  |
| Brand group order (Back, divider, ☰, mode switch)    | `chrome/lines/BrandGroup.test.tsx`                 |
| Actions group order and roles                         | `chrome/lines/ActionsGroup.test.tsx`               |
| Document group order, roles, no name on a phone       | `chrome/lines/DocumentGroup.test.tsx`              |
| Active segment renames, menu only for an Editor       | `chrome/lines/ActiveTabSegment.test.tsx`           |
| Stack count in scope; contributors up to 3 then +N    | `chrome/lines/TabListButtons.test.tsx`             |
| Tab list rows, folders, filter above 5, switch, close | `chrome/lines/TabList.test.tsx`                    |
| Tab list keyboard, focus return, rename, reorder      | `chrome/lines/TabList.keyboard.test.tsx`           |
| Strip clearance from both groups                      | `lib/top-line-clearance.test.ts`                   |
| The lines in the editor, every mode, phone, frame     | `e2e/two-lines.spec.ts` (dark)                     |
| The tours still ring their targets                    | `e2e/editor-tour.spec.ts`, `e2e/draw-tour.spec.ts` |

## Constants and configuration

In `apps/live/components/chrome/lines/line-constants.ts`:

| Constant               | Value                                       | Provenance                                  | Safe range |
| ---------------------- | ------------------------------------------- | ------------------------------------------- | ---------- |
| `CONTRIBUTORS_SHOWN`   | 3                                           | Spec: up to three avatars, then +N          | 1 to 5     |
| `TAB_LIST_FILTER_FROM` | 6                                           | Default: the filter shows above five tabs   | 4 to 10    |
| `TAB_LIST_WIDTH_PX`    | 320                                         | Mock-up F                                   | 280 to 400 |
| `TAB_LIST_GAP_PX`      | 10                                          | Mock-up F: the arrow's gap above the button | 6 to 12    |
| `TAB_LIST_EDGE_PX`     | 12                                          | Spec: 12 px inside the canvas               | 8 to 16    |
| `DOC_NAME_MIN_PX`      | 72                                          | Spec: the name shortens down to 72 px       | 48 to 120  |
| `BACK_CARET`           | 8 × 14, stroke 1.75, `M6.5 1.5 1.5 7l5 5.5` | Spec / mock-up F                            | fixed      |

## Defaults ledger

Rows in [DEFAULTS.md](DEFAULTS.md) under "two-lines".
