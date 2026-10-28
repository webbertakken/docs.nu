# New Document menu: blueprint

Derived from [New Document menu](../new-document-menu.md), with the explicit blank of
[Template starts](../../007-editor/start-diagramming.md#when-it-shows), the in-place handoff of
[New document route](../../007-editor/new-document-route.md#in-place-handoff-to-the-editor), the menus of
[Menus](../../004-interface-design/menus.md) and the placement of [Document placement](document-placement.md).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                                                 | Role                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/templates/src/new-document-blanks.ts`                                                                      | Pure data: `NEW_DOCUMENT_BLANKS`, `NewDocumentBlankId`, `newDocumentBlankOf`          |
| `packages/templates/src/{templates,template-modes,template-categories,plan-template-catalogue,template-keywords}.ts` | The `blank-board` template, registered as every blank is                              |
| `packages/template-previews/src/*`                                                                                   | The `blank-board` preview                                                             |
| `apps/live/lib/new-document/last-blank.ts`                                                                           | `readLastBlank`, `writeLastBlank` (localStorage)                                      |
| `apps/live/lib/new-document/pane-groups.ts`                                                                          | `paneGroupsFor(blank)`: the pane's template groups, from the starts and the catalogue |
| `apps/live/app/explorer/new-document/NewDocumentButton.tsx`                                                          | The split button; owns open state; lazy-mounts the menu                               |
| `apps/live/app/explorer/new-document/NewDocumentMenu.tsx`                                                            | The desktop popover: pane left, list right                                            |
| `apps/live/app/explorer/new-document/NewDocumentPane.tsx`                                                            | Every template of the blank, grouped, scrolling under sticky headings                 |
| `apps/live/app/explorer/new-document/NewDocumentSheet.tsx`                                                           | The phone's bottom sheet                                                              |
| `apps/live/app/explorer/new-document/menu-aim.ts`                                                                    | Pure: `isHeadingTowards(previous, current, target)`                                   |
| `apps/live/app/explorer/new-document/useMenuAim.ts`                                                                  | Hover selection held while the pointer heads for the pane                             |
| `apps/live/app/explorer/new-document/new-document-keys.ts`                                                           | Pure: key to `MenuMove`                                                               |
| `apps/live/app/explorer/new-document/blank-glyphs.tsx`                                                               | One glyph and tint per blank                                                          |
| `apps/live/app/explorer/new-document/start-new-document.ts`                                                          | `startNewDocument(request)`: the one way the menu makes a document                    |
| `apps/live/app/explorer/{PaneHeader.tsx,pane-create-action.ts,ExplorerPane.tsx}`                                     | The button in place of the Create dropdown; New Folder passed into the menu           |
| `packages/api-schema/src/telemetry-schema.ts`, `apps/telemetry/app/*`                                                | The new `type` tokens and their sentences                                             |

## Domain and naming

| Spec term         | Identifier                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| New Document menu | `NewDocumentButton`, `NewDocumentMenu`, `NewDocumentSheet`                               |
| blank             | `NewDocumentBlank`, `NewDocumentBlankId`                                                 |
| last blank        | `readLastBlank`, `writeLastBlank`, key `livedoc:v2:last-new-document-blank`              |
| template group    | `PaneGroup`, `paneGroupsFor`, `NewDocumentBlank.templates` (`NewDocumentTemplateSource`) |
| choice            | `NewDocumentChoice = 'blank' \| 'template'`                                              |

`NewDocumentBlankId = 'diagram' | 'whiteboard' | 'page' | 'sheet' | 'board' | 'slides' | 'form' | 'workshop'`.

## Interfaces and contracts

```ts
type NewDocumentTemplateSource =
  | { start: Exclude<EditorMode, 'plan'>; group?: string } // a template start's groups, or one of them
  | { plan: 'sheets' | 'boards' | 'forms' }; // a Plan family

type NewDocumentBlank = {
  id: NewDocumentBlankId;
  name: string; // 'Diagram'
  blank: TemplateKind; // what the blank makes
  templates: NewDocumentTemplateSource; // where the pane's templates come from
};

type PaneGroup = { id: string; name: string; kinds: readonly TemplateKind[] };

type NewDocumentRequest = {
  choice: NewDocumentChoice;
  blank: NewDocumentBlankId;
  template: TemplateKind; // the blank's own for 'blank', the card's for 'template'
  place: { folderId?: string; teamId?: string }; // the section's; absent is no choice
};

function paneGroupsFor(blank: NewDocumentBlank): PaneGroup[];
function startNewDocument(request: NewDocumentRequest): void;
```

| Blank      | `blank`             | `templates`                             |
| ---------- | ------------------- | --------------------------------------- |
| diagram    | `blank`             | `{ start: 'diagram' }`                  |
| whiteboard | `whiteboard`        | `{ start: 'draw' }`                     |
| page       | `blank-article`     | `{ start: 'pages', group: 'articles' }` |
| sheet      | `blank-spreadsheet` | `{ plan: 'sheets' }`                    |
| board      | `blank-board`       | `{ plan: 'boards' }`                    |
| slides     | `blank-slide-deck`  | `{ start: 'pages', group: 'slides' }`   |
| form       | `blank-form`        | `{ plan: 'forms' }`                     |
| workshop   | `blank-session`     | `{ start: 'workshop' }`                 |

- `paneGroupsFor` (D191): a start source lists `TEMPLATE_STARTS[start].groups` (Recommended first), or only the
  named group; each template once, under the first group holding it; blanks left out; empty groups dropped. A Plan
  source is one group: `sheets` the spreadsheet Plan templates (`isSpreadsheetPlanTemplate`), `boards` the other
  Plan templates, `forms` `FORM_TEMPLATE_KINDS`, each in catalogue order, blanks left out, named "Sheet Templates",
  "Board Templates", "Form Templates" (D192).
- The menu passes New Folder in as `onCreateFolder` and `folderLabel`, as the header does today.

## Behaviour and state

`NewDocumentButton` state: `open: boolean`, `selected: NewDocumentBlankId` (set to `readLastBlank()` on each open),
`aimHeld: boolean` (useMenuAim). Transitions:

| From   | Event                                   | To / effect                                          |
| ------ | --------------------------------------- | ---------------------------------------------------- |
| closed | face click / Enter / Space              | `startNewDocument({ choice: 'blank', blank: last })` |
| closed | caret click, Down on the face, Alt+Down | open, `selected = last`, focus the selected row      |
| open   | row pointer move, not `aimHeld`         | `selected = row`                                     |
| open   | row click, Enter on a row               | blank of `selected`; close                           |
| open   | digit 1 to 8                            | blank of that row; close                             |
| open   | template card click / Enter             | `choice: 'template'`; close                          |
| open   | Escape, outside press, Tab out          | close; Escape returns focus to the caret             |
| open   | New Folder                              | `onCreateFolder()`; close                            |

- Every document choice calls `writeLastBlank(blank)` before `startNewDocument`.
- A blank choice marks the new tab's start closed (`closeStartForBlank`) inside `startNewDocument`; a template never does.
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
- Pane: `NEW_DOCUMENT_PANE_HEIGHT_REM` (26rem) tall, scrolling inside itself (`overscroll-contain`), keyed on the
  blank so another blank starts at its top. Each group: an `h3` heading (10 px uppercase tracking), sticky at the
  pane's top over a 95% surface with blur; a 3-column grid of cards, each a 56 px preview (`TemplatePicture`) over
  its title (11 px, one line, truncated). A 32 px fade at the pane's foot.
- Phone (below `sm`): `NewDocumentSheet` from the bottom edge, rounded top, the list rows 44 px; each row's trailing
  **Templates** button swaps to the pane with **Back**; the pane (half the screen tall) has two columns.

## Accessibility

- Face: `aria-label="New {name}"`. Caret: `aria-label="More new document choices"`, `aria-haspopup="menu"`,
  `aria-expanded`, `aria-controls`.
- List: `role="menu"` `aria-label="New Document"`; rows `role="menuitem"`, `aria-label="{name}, blank"`,
  `aria-keyshortcuts="{n}"`; the selected row is the roving tab stop. The pane: `role="group"`
  `aria-label="{name} templates"`, its sections labelled by their `h3`; every card is a `menuitem`.
- Keys: `new-document-keys.ts` maps Up, Down (wrap), Home, End, Left (into the pane's first template), Right (from the
  pane's right column back to the selected row), Enter, digits, Escape. The pane's cards move as a 3-column grid, the rows of every group in turn (`paneSpots`); the card reached scrolls into view (`block: 'nearest'`, `scroll-mt` clear of the heading).
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

| Case                                      | Handling                                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `last blank` holds an unknown id          | Read as Diagram; logged `[new-document] last-blank-unknown`          |
| localStorage unavailable                  | Last blank is Diagram, kept in memory for the session                |
| A double click on the face                | One document: `startNewDocument` ignores calls while one is starting |
| The section offers no New Document        | No button (`paneHeaderActions`)                                      |
| A template whose kind is unknown at build | A unit test fails: every listed kind is in `TEMPLATES`               |

## Security and trust

No new trust boundary: the create is the same `POST /api/documents` with the same placement checks
([Document placement](document-placement.md)). Nothing typed reaches telemetry; every `type` is a fixed token.

## Observability

Logs (`debugLog`): `[new-document] choice=… blank=… template=…`, `opened ms=…`, `create-landed ms=…`,
`create-failed action=…`, `last-blank-unknown`.

## Testing

| Rule                                                         | Test                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| Eight blanks, in order, each a known blank of its mode       | `new-document-blanks.test.ts`                             |
| Groups as the start lists them; each template once, no blank | `pane-groups.test.ts`                                     |
| Page and Slides one group; Sheet, Board, Form a Plan family  | `pane-groups.test.ts`                                     |
| Last blank round trip, unknown, no storage                   | `last-blank.test.ts`                                      |
| Menu aim triangle                                            | `menu-aim.test.ts`                                        |
| Keys                                                         | `new-document-keys.test.ts`                               |
| Face makes the last blank; caret opens on it; digits; Escape | `NewDocumentButton.test.tsx`                              |
| A template card's request; the pane lists the blank's groups | `NewDocumentButton.test.tsx`                              |
| New Folder in the list where offered                         | `NewDocumentButton.test.tsx`, `PaneHeader.test.tsx`       |
| Blank opens with its start closed; template not              | e2e `new-document-menu.spec.ts`                           |
| Folder section files into the folder                         | e2e `new-document-menu.spec.ts`                           |
| Click to editable within budget                              | e2e `new-document-open-budget.spec.ts` (production build) |

## Constants and configuration

| Constant                          | Value | Provenance                             | Safe range |
| --------------------------------- | ----- | -------------------------------------- | ---------- |
| `NEW_DOCUMENT_PANE_HEIGHT_REM`    | 26    | About four rows of cards and a heading | 22 to 30   |
| `NEW_DOCUMENT_MENU_WIDTH_REM`     | 40    | Mockup E; the list 14.5 + a 3-up pane  | 36 to 44   |
| `MENU_AIM_DELAY_MS`               | 300   | D193                                   | 150 to 500 |
| `NEW_DOCUMENT_OPEN_BUDGET_MS`     | 200   | Spec                                   | fixed      |
| `NEW_DOCUMENT_TEMPLATE_BUDGET_MS` | 500   | Spec                                   | fixed      |

## Defaults ledger

D191 to D193 and D195 in [DEFAULTS.md](DEFAULTS.md).
