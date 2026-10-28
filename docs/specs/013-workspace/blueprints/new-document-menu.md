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
- **Web Experience.** The click is the interaction and the editor is its next paint, so INP is the open itself, inside
  the 200 ms budget; no page load means no LCP to pay again; the editor replaces the Explorer whole in one commit, so
  nothing shifts (CLS 0).
- **Data and persistence.** A pending document lives in memory only and is never written by itself: the create
  writes it (`writeNewDocument`, the same rows `/new` writes); saves are held, not queued; a reload while held with
  changes asks first. Nothing new is stored, so there is no snapshot, restore or migration to define.

## Instant open

The contract `startNewDocument` meets.

- **Budget:** click to the editor painted and editable at most `NEW_DOCUMENT_OPEN_BUDGET_MS` (200) for a blank and
  `NEW_DOCUMENT_TEMPLATE_BUDGET_MS` (500) for a template, measured in a production build.

### Modules

| File                                                              | Role                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/app/explorer/new-document/start-new-document.ts`       | The seam: the steps below, the busy guard, `prefetchNewDocumentOpen`                                                                        |
| `apps/live/lib/new-document/pending-documents.ts`                 | The registry of **pending documents** (made in the browser, create not landed)                                                              |
| `apps/live/lib/new-document/create-hold.ts`                       | The hold: `holdDocument`, `releaseDocument`, `whenDocumentCreated`, `heldDocumentIn`; free of imports, read by `apiFetch` and `isOfflineId` |
| `apps/live/lib/new-document/write-new-document.ts`                | `writeNewDocument`, `trackNewDocumentCreated`: the one create `/new`, the workbench and the Explorer share                                  |
| `apps/live/lib/new-document/create-failure.ts`                    | The failure copy (moved from `app/new/`), shared by `/new` and the not-saved banner                                                         |
| `apps/live/lib/new-document/new-document-creator.ts`              | Who is creating, bound by the Explorer shell: `bindNewDocumentCreator`, `newDocumentCreator`                                                |
| `apps/live/lib/editor-page-loader.ts`                             | `loadEditorPage()`, `loadedEditorPage()`: the editor's chunk, fetched once                                                                  |
| `apps/live/app/explorer/in-place-editor/InPlaceEditor.tsx`        | Wraps the Explorer shell in its layout; renders the editor in its place                                                                     |
| `apps/live/app/explorer/in-place-editor/in-place-editor-store.ts` | The open and standby documents: `openInPlace`, `closeInPlace`, `setStandbyInPlace`, `useInPlaceDocuments`                                   |
| `apps/live/app/document/[id]/editor-seed-context.ts`              | `EditorSeedIdContext`: the document the Explorer renders the editor for                                                                     |
| `apps/live/app/document/[id]/seed-pending-document.ts`            | `readEditorSeed`, `notePendingOpened`: the editor's first state from a pending or standby document                                          |
| `apps/live/app/document/[id]/usePendingCreate.ts`                 | The editor's view of its create: `held`, the landing, the not-saved actions                                                                 |
| `apps/live/components/chrome/NotSavedBanner.tsx`                  | The not-saved notice in the top-centre stack                                                                                                |

### Pending documents

```ts
type PendingCreate =
  | { status: 'creating' }
  | { status: 'landed' }
  | { status: 'failed'; failure: CreateFailure };

type PendingDocument = {
  id: string;
  name: string; // untitledNameForTemplate
  tabs: Tab[]; // whole, every element
  itemTypes: ItemTypeCatalogue | null;
  ownerId: string; // the creator's id; the document's owner is OFFLINE_OWNER_ID in This Browser
  location: SaveLocationId; // 'livedoc' or 'browser' (This Browser)
  teamId: string | null;
  startedAt: number; // performance.now() at the click
  create: PendingCreate;
};

addPendingDocument(doc, write: (place: NewDocumentPlace) => Promise<void>, place): void; // runs write at once
pendingDocument(id): PendingDocument | null;
subscribePendingDocuments(listener): () => void;
retryPendingDocument(id, { withoutPlacement }): void; // the same ids, the same write
attachPendingEditor(id, hasUnsavedChanges): () => void;
isPendingSettled(id): boolean; // landed, and the editor holds nothing unsaved
forgetPendingDocument(id): void;
// create-hold.ts
whenDocumentCreated(id): Promise<void> | null; // null once landed or never pending
heldDocumentIn(url): string | null; // a pending id the url names
```

- A pending document's **hold** is one promise per id, resolved when its create lands and never rejected: a failed
  create keeps everything that waits on it waiting, and Try again's landing releases it.
- `apiFetch` awaits `whenDocumentCreated(heldDocumentIn(url))` before it sends, so every read and write naming the
  document (items, sheets, comments, its tabs) waits for the create and goes out in the order it was made. The
  create itself (`POST /api/documents`) names no id in its URL and is never held.
- `isOfflineId(id)` awaits the same hold, so a request for a This Browser document cannot be routed to the server
  before `offlineCreateDocument` has registered it.

### Steps of `startNewDocument`

1. Busy (a start in progress): ignored, logged `[new-document] busy`.
2. Inside a workspace frame (`interceptAppNavigation` takes the `/new?template=…&folder=…&team=…` href): the frame's
   own create in place makes it. Done.
3. No creator bound (not on the Explorer, or the guest id not resolved yet): `assignAppLocation` to the same href,
   the `/new` path, logged `[new-document] no-creator`. Done.
4. Take the standby when it is what the request makes; otherwise mint `documentId`, `tabId`; a blank closes its tab's start (`closeStartForBlank`); a cloud blank hands its
   template pick (`handTemplatePick`), as `/new` does; `markNameConfirmed`.
5. The location: LiveDoc when placed, else `defaultSaveLocationFor({ signedIn, signInOffered: signInOfferedHere() === true })`.
6. The content: `newDocumentContent({ templateKind, themeId: NEW_DOCUMENT_THEME_ID, tabId, via: 'explorer' })`.
7. `await loadEditorPage()` (already in from the prefetch in practice).
8. `addPendingDocument`, which starts `writeNewDocument` without awaiting it.
9. `history.pushState(null, '', '/document/<id>')`, then `openInPlace(id)`.

### The editor's bootstrap branch

- The editor's state is **seeded in its first render**: `useEditorState` reads `readEditorSeed` once
  (`seed-pending-document.ts`) for the document it is rendered for (`EditorSeedIdContext`, else the address). A pending
  or standby document gives every initial value at once: the tabs (`useDocumentHistory`), the active tab, every tab id
  loaded, the save baseline (`lastSavedTabsRef`, `lastSavedNameRef`), the name and item types, the owner (the creator,
  or `OFFLINE_OWNER_ID` in This Browser) and team, the reader (the creator's id with the placeholder name and colour),
  `documentId`, `hydrated: true`, `loadingDocument: false`. No loading pass, no state set after mount, no
  `apiLoadDocument`, no tab fetch, no share-link list, no `Document·Loaded`; `documentServerStored` stays false.
- `useIdentityBootstrap`'s first layout effect finds the pending document and only notes the open
  (`notePendingOpened`): `setLoadStep('done')` and the `NewDocumentOpen` timing from `startedAt`, ended after paint,
  which also logs `[new-document] opened ms=<n>`. The reader's profile and the lists settle in the background, as for
  an early open (`settleEarlyIdentity`).
- **Transitions (D204):** the in-place store (`useInPlaceDocuments`) and the pending create (`usePendingCreate`) are
  followed with `startTransition`, so the editor's reveal and a create that lands at once (This Browser's) re-render
  after the first frame is painted, never before it.

### Standby

- While nothing is open in place and the Explorer is idle (`requestIdleCallback`, at most `STANDBY_IDLE_TIMEOUT_MS`),
  `InPlaceEditor` asks `prepareStandbyDocument(lastBlank)`: once the editor's chunk is in and a creator is bound, the
  face's blank is prepared (ids, content, its start closed, where an unplaced document is stored) and registered as the
  **standby** (`addStandbyDocument`), and the editor is rendered for it inside `<Activity mode="hidden">`: built at
  the lowest priority, effects not run, nothing created, nothing fetched (D205).
- The face's click whose request matches the standby (same choice, template, creator and store) takes it
  (`takeStandby`) instead of preparing anew; `openInPlace` moves the same editor from standby to open in one update,
  so the click only reveals it and runs its effects. Logged `[new-document] standby=used|none`.
- A template, another blank, or a placed folder's choice is prepared fresh at the click, as before (D206). A new
  standby follows when the last blank, the creator or the open document changes; one never used is dropped with the
  page.

### Saves held until the create lands

- `usePendingCreate(documentId)` reads the registry: `held` while the document is pending and its create has not
  landed. `useAutosave` and `useUnloadFlush` take `held`: no debounced save and no flush while held; leaving while
  held with changes asks first (`shouldWarnOnLeave`).
- On landing: `documentServerStored` becomes true for LiveDoc (the room connects), the Explorer lists refresh, and
  the autosave effect runs once with the diff of everything done meanwhile against the created content: the held
  saves flush once.
- The editor attaches `hasUnsavedChanges` to the registry and forgets the pending document when it unmounts.

### Failure

- A create that fails sets `failed` with `createFailureCopy(error)`; the editor stays as it is and nothing is saved.
- `NotSavedBanner` (top-centre, first in the stack, `role="alert"`): "Not saved yet. {message}" with **Try again**
  (`retry`: the same ids, the same place) or **Save to My Documents** (`choose`: the same ids, no placement).
- `Document·Created`, `Template·Used`, `Theme·Changed` and `Team·Added·Document` fire on landing
  (`trackNewDocumentCreated`), as `/new` sends them.

### In the Explorer's place

- `InPlaceEditor` wraps `ExplorerShell` in `app/explorer/layout.tsx`. With a document open in place and the address
  on `/document/<id>` (`usePathname`), it renders `loadedEditorPage()` in its own `Suspense` (fallback
  `OpeningScreen`) instead of the Explorer.
- **Back:** the address leaves `/document/<id>` (popstate, or the editor's own navigation within the Explorer
  layout), and the Explorer renders again. An editor whose document is not settled (`isPendingSettled`) stays
  mounted, hidden, until it is (checked every `IN_PLACE_SETTLE_POLL_MS`), so held changes still save; Forward shows
  it again. Logged `[new-document] back-while-pending`.
- The editor's chunk is fetched on idle by `InPlaceEditor` and on pointer enter or focus of the button
  (`prefetchNewDocumentOpen`, which also fetches the Plan template seeds' chunk).

## Errors and edge cases

| Case                                      | Handling                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `last blank` holds an unknown id          | Read as Diagram; logged `[new-document] last-blank-unknown`           |
| localStorage unavailable                  | Last blank is Diagram, kept in memory for the session                 |
| A double click on the face                | One document: `startNewDocument` ignores calls while one is starting  |
| The section offers no New Document        | No button (`paneHeaderActions`)                                       |
| A template whose kind is unknown at build | A unit test fails: every listed kind is in `TEMPLATES`                |
| The create fails (network, 5xx, storage)  | Editor stays; `NotSavedBanner` with Try again; logged `create-failed` |
| The create's placement is refused         | `NotSavedBanner` with Save to My Documents (no placement)             |
| Back before the create lands              | The editor stays mounted, hidden, until settled (D198)                |
| No creator bound                          | The `/new` path; logged `[new-document] no-creator`                   |
| Inside a workspace frame                  | The frame's own create in place                                       |
| Closing the page while held with changes  | The browser asks first (`shouldWarnOnLeave`)                          |

## Security and trust

No new trust boundary: the create is the same `POST /api/documents` with the same placement checks
([Document placement](document-placement.md)). Nothing typed reaches telemetry; every `type` is a fixed token.

## Observability

Logs (`debugLog`): `[new-document] choice=… blank=… template=…`, `opened ms=…`, `create-landed ms=…`,
`create-failed action=…`, `busy`, `no-creator`, `held <method> <path>`, `back-while-pending`, `last-blank-unknown`.
Timing `NewDocumentOpen` ([Timing telemetry](../../017-telemetry/timing-telemetry.md)).

## Testing

| Rule                                                                 | Test                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Eight blanks, in order, each a known blank of its mode               | `new-document-blanks.test.ts`                                           |
| Groups as the start lists them; each template once, no blank         | `pane-groups.test.ts`                                                   |
| Page and Slides one group; Sheet, Board, Form a Plan family          | `pane-groups.test.ts`                                                   |
| Last blank round trip, unknown, no storage                           | `last-blank.test.ts`                                                    |
| Menu aim triangle                                                    | `menu-aim.test.ts`                                                      |
| Keys                                                                 | `new-document-keys.test.ts`                                             |
| Face makes the last blank; caret opens on it; digits; Escape         | `NewDocumentButton.test.tsx`                                            |
| A template card's request; the pane lists the blank's groups         | `NewDocumentButton.test.tsx`                                            |
| New Folder in the list where offered                                 | `NewDocumentButton.test.tsx`, `PaneHeader.test.tsx`                     |
| Blank opens with its start closed; template not                      | e2e `new-document-open-budget.spec.ts`, `start-new-document.test.ts`    |
| Folder section files into the folder                                 | `start-new-document.test.ts`                                            |
| Click to editable within budget                                      | e2e `new-document-open-budget.spec.ts` (production build)               |
| Retry uses the same ids; Save to My Documents drops place            | `pending-documents.test.ts`, `start-new-document.test.ts`               |
| Busy guard; frame; no creator; blank closes its start                | `start-new-document.test.ts`                                            |
| One create for both stores; telemetry on landing                     | `write-new-document.test.ts`                                            |
| Seeded from memory, every tab loaded, baseline set                   | `seed-pending-document.test.ts`, `useIdentityBootstrap.pending.test.ts` |
| Standby made ahead, nothing created; the click opens it under its id | `start-new-document.test.ts`, `InPlaceEditor.test.tsx`                  |
| Held saves flush once; failed create keeps edits                     | `usePendingCreate.test.tsx`, `useAutosave.test.tsx`                     |
| Editor shown on its address; Back hides; kept until settled          | `InPlaceEditor.test.tsx`                                                |
| Signed-in cloud create within budget                                 | e2e `apps/live/e2e/account/new-document-open-budget.spec.ts`            |
| Hold resolves on landing, never on failure; url matching             | `pending-documents.test.ts`, `core.test.ts`, `offline-ids.test.ts`      |
| Opened from memory before auth, nothing fetched                      | `useIdentityBootstrap.pending.test.ts`                                  |
| Not-saved banner: Try again or Save to My Documents                  | `NotSavedBanner.test.tsx`                                               |
| Creator bound by the shell; editor chunk loaded once                 | `new-document-creator.test.ts`, `editor-page-loader.test.ts`            |
| `NewDocumentOpen` timing reports its duration                        | `timing.test.ts` (telemetry-client)                                     |

## Constants and configuration

| Constant                          | Value | Provenance                             | Safe range  |
| --------------------------------- | ----- | -------------------------------------- | ----------- |
| `NEW_DOCUMENT_PANE_HEIGHT_REM`    | 26    | About four rows of cards and a heading | 22 to 30    |
| `NEW_DOCUMENT_MENU_WIDTH_REM`     | 40    | Mockup E; the list 14.5 + a 3-up pane  | 36 to 44    |
| `MENU_AIM_DELAY_MS`               | 300   | D193                                   | 150 to 500  |
| `NEW_DOCUMENT_OPEN_BUDGET_MS`     | 200   | Spec                                   | fixed       |
| `NEW_DOCUMENT_TEMPLATE_BUDGET_MS` | 500   | Spec                                   | fixed       |
| --------------------------------- | ----- | -------------------------------------- | ----------- |
| `IN_PLACE_SETTLE_POLL_MS`         | 250   | D198                                   | 100 to 1000 |
| `STANDBY_IDLE_TIMEOUT_MS`         | 2000  | D205                                   | 500 to 5000 |

## Defaults ledger

D191 to D193 and D195 to D206 in [DEFAULTS.md](DEFAULTS.md).
