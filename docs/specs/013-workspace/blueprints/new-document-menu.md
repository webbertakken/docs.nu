# New Document menu: blueprint

Derived from [New Document menu](../new-document-menu.md), with the explicit blank of
[Template starts](../../007-editor/start-diagramming.md#when-it-shows), the in-place handoff of
[New document route](../../007-editor/new-document-route.md#in-place-handoff-to-the-editor), the menus of
[Menus](../../004-interface-design/menus.md) and the placement of [Document placement](document-placement.md).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                                                 | Role                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/templates/src/new-document-blanks.ts`                                                                      | Pure data: `NEW_DOCUMENT_BLANKS`, `NewDocumentBlankId`, `newDocumentBlankOf`     |
| `packages/templates/src/{templates,template-modes,template-categories,plan-template-catalogue,template-keywords}.ts` | The `blank-board` template, registered as every blank is                         |
| `packages/template-previews/src/*`                                                                                   | The `blank-board` preview                                                        |
| `apps/live/lib/new-document/last-blank.ts`                                                                           | `readLastBlank`, `writeLastBlank` (localStorage)                                 |
| `apps/live/lib/new-document/picker-group-count.ts`                                                                   | `pickerGroupCount(blank)`: the N of All N templates, from the starts' own groups |
| `apps/live/components/start/start-group.ts`                                                                          | `handStartGroup`, `takeStartGroup` (sessionStorage), read by both start panels   |
| `apps/live/app/explorer/new-document/NewDocumentButton.tsx`                                                          | The split button; owns open state; lazy-mounts the menu                          |
| `apps/live/app/explorer/new-document/NewDocumentMenu.tsx`                                                            | The desktop popover: pane left, list right                                       |
| `apps/live/app/explorer/new-document/NewDocumentPane.tsx`                                                            | The blank card, the six templates, All N templates                               |
| `apps/live/app/explorer/new-document/NewDocumentSheet.tsx`                                                           | The phone's bottom sheet                                                         |
| `apps/live/app/explorer/new-document/menu-aim.ts`                                                                    | Pure: `isHeadingTowards(previous, current, target)`                              |
| `apps/live/app/explorer/new-document/useMenuAim.ts`                                                                  | Hover selection held while the pointer heads for the pane                        |
| `apps/live/app/explorer/new-document/new-document-keys.ts`                                                           | Pure: key to `MenuMove`                                                          |
| `apps/live/app/explorer/new-document/blank-glyphs.tsx`                                                               | One glyph and tint per blank                                                     |
| `apps/live/app/explorer/new-document/start-new-document.ts`                                                          | `startNewDocument(request)`: the one way the menu makes a document               |
| `apps/live/app/explorer/{PaneHeader.tsx,pane-create-action.ts,ExplorerPane.tsx}`                                     | The button in place of the Create dropdown; New Folder passed into the menu      |
| `packages/api-schema/src/telemetry-schema.ts`, `apps/telemetry/app/*`                                                | The new `type` tokens and their sentences                                        |

## Domain and naming

| Spec term         | Identifier                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| New Document menu | `NewDocumentButton`, `NewDocumentMenu`, `NewDocumentSheet`                  |
| blank             | `NewDocumentBlank`, `NewDocumentBlankId`                                    |
| last blank        | `readLastBlank`, `writeLastBlank`, key `livedoc:v2:last-new-document-blank` |
| picker group      | `NewDocumentBlank.picker`, `handStartGroup`, `takeStartGroup`               |
| choice            | `NewDocumentChoice = 'blank' \| 'template' \| 'all-templates'`              |

`NewDocumentBlankId = 'diagram' | 'whiteboard' | 'page' | 'sheet' | 'board' | 'slides' | 'form' | 'workshop'`.

## Interfaces and contracts

```ts
type NewDocumentBlank = {
  id: NewDocumentBlankId;
  name: string; // 'Diagram'
  line: string; // the blank card's line
  blank: TemplateKind; // what the blank makes
  templates: readonly TemplateKind[]; // at most NEW_DOCUMENT_TEMPLATES_MAX, in order
  picker: { mode: EditorMode; group: string }; // where All templates opens
};

type NewDocumentRequest = {
  choice: NewDocumentChoice;
  blank: NewDocumentBlankId;
  template: TemplateKind; // the blank's own for 'blank', the card's for 'template', the picker mode's blank for 'all-templates'
  place: { folderId?: string; teamId?: string }; // the section's; absent is no choice
};

function startNewDocument(request: NewDocumentRequest): void;
```

| Blank      | `blank`             | `templates` (in order)                                                                                          | `picker`                   |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| diagram    | `blank`             | Start Diagramming's Recommended less its blank, then `swimlane`                                                 | `diagram` / `recommended`  |
| whiteboard | `whiteboard`        | Start Drawing's Recommended less its blank, then `paper-prototype`                                              | `draw` / `recommended`     |
| page       | `blank-article`     | `article`, `working-backwards`, `resume`, `recipe-card`                                                         | `pages` / `articles`       |
| sheet      | `blank-spreadsheet` | `budget-planner`, `timesheet`, `invoice`, `expense-report`, `contact-list`, `sales-pipeline`                    | `plan` / `spreadsheets`    |
| board      | `blank-board`       | `kanban`, `bug-triage`, `weekly-planner`, `content-calendar`, `hiring-pipeline`, `feedback-board`               | `plan` / `boards`          |
| slides     | `blank-slide-deck`  | `slide-deck`, `launch-keynote`, `quarterly-review`, `team-welcome`, `workshop-kickoff`                          | `pages` / `slides`         |
| form       | `blank-form`        | `feedback-form`, `bug-report-form`, `feature-request-form`, `rsvp-form`, `job-application-form`, `contact-form` | `plan` / `forms`           |
| workshop   | `blank-session`     | Start a Workshop's Recommended less its blank, first six                                                        | `workshop` / `recommended` |

- Diagram, Whiteboard and Workshop are written out in the data as their Recommended stands today; a test holds
  their lead equal to the mode's Popular shelf less blanks (Recommended's source), so the two cannot drift (D191).
- `pickerGroupCount` counts the cards the picker group shows on an empty document with no cards: a template start's
  group `kinds.length` less blanks; for Recommended, every template the mode's start lists (its "All 61"); for Start
  Planning, the group's cards from `start-planning-items.ts` with no document cards (D192).
- The menu passes New Folder in as `onCreateFolder` and `folderLabel`, as the header does today.

## Behaviour and state

`NewDocumentButton` state: `open: boolean`, `selected: NewDocumentBlankId` (set to `readLastBlank()` on each open),
`aimHeld: boolean` (useMenuAim). Transitions:

| From   | Event                                       | To / effect                                                                                                         |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| closed | face click / Enter / Space                  | `startNewDocument({ choice: 'blank', blank: last })`                                                                |
| closed | caret click, Down on the face, Alt+Down     | open, `selected = last`, focus the selected row                                                                     |
| open   | row pointer move, not `aimHeld`             | `selected = row`                                                                                                    |
| open   | row click, blank card click, Enter on a row | blank of `selected`; close                                                                                          |
| open   | digit 1 to 8                                | blank of that row; close                                                                                            |
| open   | template card click / Enter                 | `choice: 'template'`; close                                                                                         |
| open   | All N templates                             | `choice: 'all-templates'`, `template = BLANK_TEMPLATE_FOR_MODE[picker.mode]`, `handStartGroup(picker.group)`; close |
| open   | Escape, outside press, Tab out              | close; Escape returns focus to the caret                                                                            |
| open   | New Folder                                  | `onCreateFolder()`; close                                                                                           |

- Every document choice calls `writeLastBlank(blank)` before `startNewDocument`.
- A blank choice marks the new tab's start closed (`closeStartForBlank`) inside `startNewDocument`; a template or
  All templates never does.
- **Menu aim** (`isHeadingTowards`): with the pane on the left, the target is the pane's right edge, from its top to
  its bottom corner. The pointer heads towards it when the current point lies inside the triangle of the previous point
  and those two corners. While heading, a row entered does not select; `MENU_AIM_DELAY_MS` after the last move, or on
  a move that does not head towards it, the row under the pointer selects (D193).

## Presentation and UX

- Button: `Button size="xs"` face plus a caret `Button` joined (`rounded-r-none` / `rounded-l-none`, a
  `border-l border-white/25` hairline), brand fill, as tall as Help (28 px). Face label `New {name}`; below `sm` the
  label hides and the blank's glyph shows beside the plus.
- Popover: `PortalMenu`'s frame (border, `bg-white/90 dark:bg-slate-900/90`, blur, shadow), right-aligned to the
  caret's right edge, 8 px below; width `NEW_DOCUMENT_MENU_WIDTH_REM` (40rem); list column 14.5rem; pane
  `flex-1`, padding 12 px, a hairline between.
- Row: 32 px tall, glyph 16 px in its tint, name 13 px medium, key cap (10 px, bordered) right; selected row
  `bg-slate-100 dark:bg-slate-800`, a leading chevron pointing at the pane.
- Blank card: preview 96 by 56 px (`TemplatePicture` of the blank), `Blank {name}` 13 px semibold, line 11 px,
  Enter key cap; brand border and ring.
- Templates: `From a template` heading (10 px uppercase tracking), a 3-column grid, each card a 56 px preview
  (`TemplatePicture`) over its title (11 px, one line, truncated with a title tooltip).
- Foot: `All {N} {name} templates` with the grid glyph and a chevron, brand text.
- Phone (below `sm`): `NewDocumentSheet` from the bottom edge, rounded top, the list rows 44 px; each row's trailing
  **Templates** button swaps to the pane with **Back**; the pane's grid is two columns.
- Copy: lines per blank — Diagram "An empty canvas, open at once.", Whiteboard "A clear board and a pen in hand.",
  Page "An empty page to write on.", Sheet "An empty grid, ready to type into.", Board "An empty board: set up its
  columns.", Slides "An empty 16:9 slide.", Form "A form with no questions yet.", Workshop "An empty board to run a
  session on." (D194).

## Accessibility

- Face: `aria-label="New {name}"`. Caret: `aria-label="More new document choices"`, `aria-haspopup="menu"`,
  `aria-expanded`, `aria-controls`.
- List: `role="menu"` `aria-label="New Document"`; rows `role="menuitem"`, `aria-label="{name}, blank"`,
  `aria-keyshortcuts="{n}"`; the selected row is the roving tab stop. Pane: `role="group"`
  `aria-label="{name} templates"`, cards are buttons.
- Keys: `new-document-keys.ts` maps Up, Down (wrap), Home, End, Left (into the pane's first focusable), Right (from the
  pane's right column back to the selected row), Enter, digits, Escape. The pane's cards move as a 3-column grid.
- Contrast: key caps and lines `text-slate-500` on white, `text-slate-400` on slate-900 (both at least 4.5:1); focus
  ring `outline-brand-500` 2 px. Reduced motion: no fade (`motion-safe:animate-fade-in`).

## Performance and limits

- The menu's code is a lazy chunk; `NewDocumentButton` imports it on pointer enter or focus of the button, and on
  idle (D195). Previews draw only while open.
- Opening at once: [Instant open](#instant-open).

## Instant open

The contract `startNewDocument` meets; its implementation is derived here before it is built.

- **Budget:** click to the editor painted and editable at most `NEW_DOCUMENT_OPEN_BUDGET_MS` (200) for a blank and
  `NEW_DOCUMENT_TEMPLATE_BUDGET_MS` (500) for a template, measured in a production build.
- **Steps:** mint `documentId`, `tabId`; build the content (`newDocumentContent`); register it in memory for the
  editor; `history.pushState` to `/document/<id>`; render the editor in the Explorer's place; start the create (cloud
  `apiCreateDocument` with the place and intent, or `offlineCreateDocument` for This Browser) without awaiting it.
- **The editor** opens a document registered in memory without `apiLoadDocument` or a tab fetch; until the create
  lands it is not server-stored (no room, saves held); when it lands the room connects and held saves flush.
- **Failure:** a create that fails keeps the editor and its edits, shows a not-saved notice with Try again (same ids)
  or, for a refused placement, Save to My Documents (no placement).
- **Back:** popstate to an Explorer address while the editor is shown renders the Explorer again.
- The details (module names, the bootstrap branch, the save hold) are written here by the implementer before code.

## Errors and edge cases

| Case                                      | Handling                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `last blank` holds an unknown id          | Read as Diagram; logged `[new-document] last-blank-unknown`                    |
| localStorage / sessionStorage unavailable | Last blank is Diagram; the group is not handed, the start opens on Recommended |
| A double click on the face                | One document: `startNewDocument` ignores calls while one is starting           |
| The section offers no New Document        | No button (`paneHeaderActions`)                                                |
| A template whose kind is unknown at build | A unit test fails: every listed kind is in `TEMPLATES`                         |
| `takeStartGroup` names an unknown group   | Recommended; logged `[start] group-unknown`                                    |

## Security and trust

No new trust boundary: the create is the same `POST /api/documents` with the same placement checks
([Document placement](document-placement.md)). Nothing typed reaches telemetry; every `type` is a fixed token.

## Observability

Logs (`debugLog`): `[new-document] choice=… blank=… template=…`, `opened ms=…`, `create-landed ms=…`,
`create-failed action=…`, `last-blank-unknown`; `[start] group=<id>` when a start takes a handed group.

## Testing

| Rule                                                         | Test                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| Eight blanks, in order, each template known, at most six     | `new-document-blanks.test.ts`                             |
| Diagram, Whiteboard, Workshop templates equal Recommended    | `new-document-blanks.test.ts`                             |
| Every blank's mode matches its template's mode               | `new-document-blanks.test.ts`                             |
| N is the picker group's count                                | `picker-group-count.test.ts`                              |
| Last blank round trip, unknown, no storage                   | `last-blank.test.ts`                                      |
| Group handed once, unknown ignored                           | `start-group.test.ts`, `StartPanel.test.tsx`              |
| Menu aim triangle                                            | `menu-aim.test.ts`                                        |
| Keys                                                         | `new-document-keys.test.ts`                               |
| Face makes the last blank; caret opens on it; digits; Escape | `NewDocumentButton.test.tsx`                              |
| Template card and All templates requests                     | `NewDocumentMenu.test.tsx`                                |
| New Folder in the list where offered                         | `NewDocumentMenu.test.tsx`, `PaneHeader.test.tsx`         |
| Blank opens with its start closed; template not              | e2e `new-document-menu.spec.ts`                           |
| Folder section files into the folder                         | e2e `new-document-menu.spec.ts`                           |
| Click to editable within budget                              | e2e `new-document-open-budget.spec.ts` (production build) |

## Constants and configuration

| Constant                          | Value | Provenance                             | Safe range |
| --------------------------------- | ----- | -------------------------------------- | ---------- |
| `NEW_DOCUMENT_TEMPLATES_MAX`      | 6     | Spec: six                              | 3 to 6     |
| `NEW_DOCUMENT_MENU_WIDTH_REM`     | 40    | Mockup E1; the list 14.5 + a 3-up pane | 36 to 44   |
| `MENU_AIM_DELAY_MS`               | 300   | D193                                   | 150 to 500 |
| `NEW_DOCUMENT_OPEN_BUDGET_MS`     | 200   | Spec                                   | fixed      |
| `NEW_DOCUMENT_TEMPLATE_BUDGET_MS` | 500   | Spec                                   | fixed      |

## Defaults ledger

D191 to D195 in [DEFAULTS.md](DEFAULTS.md).
