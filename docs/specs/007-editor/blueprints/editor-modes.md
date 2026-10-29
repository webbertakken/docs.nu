# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md). Implementation detail only; the spec owns every
design decision. Sketch mode's own tools are blueprinted in
[Sketch mode blueprints](../../023-draw-mode/blueprints/README.md); Pages mode's pages in
[Pages](pages-mode.md) and [Article pages](article-pages.md).

## Domain and naming

| Term                            | Identifier                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor mode                     | `EditorMode` (`'draw' \| 'diagram' \| 'pages' \| 'plan'`), `packages/document/src/editor-mode.ts`; the switchable three `SwitchableEditorMode`, `SWITCHABLE_EDITOR_MODES` (Sketch, Structured, Pages)                              |
| The mode catalogue              | `EDITOR_MODE_CATALOGUE` (`{ id, label }[]`): draw "Sketch", diagram "Structured", pages "Pages", plan "Plan"                                                                                                                       |
| Every mode                      | `EDITOR_MODES` (the four, for parsing); the default `DEFAULT_EDITOR_MODE` (`'diagram'`)                                                                                                                                            |
| What a tab or template opens as | `TabOpening` (`'draw' \| 'diagram' \| 'pages' \| 'workshop' \| 'plan'`), `TAB_OPENINGS`, `tabOpeningLabel`, `parseTabOpening`, `openingEditorMode`, `openingWorkshop`, `tabOpeningOf(tab)`, `packages/document/src/tab-opening.ts` |
| The Workshop control            | `Tab.workshop?: true`, `workshopOf(tab)`, `setTabWorkshop(tab, on)` (`editor-mode.ts`); `WorkshopControl` ([its blueprint](../../012-collaboration/blueprints/workshop-mode.md))                                                   |
| The add menu                    | `AddTabMenu` (`components/chrome/lines/AddTabMenu.tsx`), `AddTabChoice`, `ADD_TAB_ROWS`; the Plan start's landing `setPlanStartLanding` / `takePlanStartLanding` (`lib/plan-start-landing.ts`)                                     |
| A mode's words                  | `editorModeLabel(mode)`, `editorModeDescription(mode)`                                                                                                                                                                             |
| The next mode (Shift+D)         | `nextEditorMode(mode, step = 1, modes = EDITOR_MODES)`, wrapping round `modes`                                                                                                                                                     |
| A stored value is a mode        | `isEditorMode(v)`; read every stored mode through `parseEditorMode(v)` (legacy `'illustrate'`, `'infographic'` → `'pages'`, `'workshop'`, `'facilitate'` → `'diagram'`, `LEGACY_EDITOR_MODES`)                                     |
| The page look's one gate        | `hasPageLook(mode)`: true in Pages mode                                                                                                                                                                                            |
| A switch as one tab edit        | `withEditorModeSwitched(tab, mode)` (`packages/document/src/editor-mode-switch.ts`), `switchedTab(tab, next, alsoChange?)` (`useEditorMode.ts`)                                                                                    |
| May the mode be written         | `tabModeWritable(tab)` (not an event-storming board, not a Plan kind); the switch is offered where `editorModeSwitchable(tab)` (writable and not in `plan`)                                                                        |
| Leaving Pages                   | `useLeavePages(editorMode, { tab, canEdit })`, `LeavePagesDialog` ([Article pages](article-pages.md))                                                                                                                              |
| Legacy names elsewhere          | `parsePlacementDefaultKey`, `legacyPlacementDefaultKeys` (`packages/api-schema/src/placement-defaults.ts`); `illustrateModeEnabled` / `infographicModeEnabled` / `planModeEnabled` in `RETIRED` (`legacy-preferences.ts`)          |
| The tab's mode                  | `Tab.opensIn?: EditorMode` (stored name kept), read through `opensInOf(tab)`                                                                                                                                                       |
| Setting the mode                | `setTabOpensIn(tab, mode)`                                                                                                                                                                                                         |
| A tab offers the switch         | `editorModeSwitchable(tab)`: false on an event-storming board, new or legacy, and on a Board, Sheet or Dashboard tab (always Plan)                                                                                                 |
| The look's one gate             | `hasBoardLook(mode)`: true in Sketch mode (the person's own pattern)                                                                                                                                                               |
| The person's effective mode     | `useEditorMode(tab, { canEdit })` → `EditorModeState`                                                                                                                                                                              |
| The mode resolver               | `resolveEditorMode({ tab, canEdit })`, `apps/live/lib/editor-mode-store.ts`                                                                                                                                                        |
| A collaborator's switch         | `peerModeSwitchOf(op)`, `peerModeSwitchMessage(name, mode)` (`apps/live/lib/peer-mode-switch.ts`); `useRoomConnection` `receivePeerModeSwitch`                                                                                     |
| May this person edit            | `useViewPreview(...).canEdit`, `apps/live/app/document/[id]/useViewPreview.ts`                                                                                                                                                     |
| The mode switch                 | `EditorModeSwitch` beside the menu button (`ToolbarExplorerButton`) and `StartModeSwitch` (`apps/live/components/start/`), a start panel's rail: chip `ModeMenuChip`, menu `ModeMenu`, `apps/live/components/chrome/editor-mode/`  |
| The editor's resolved mode      | `EditorModeProvider` / `useEditorModeState()`, `editor-mode-context.tsx`                                                                                                                                                           |
| The tab pill's mode icon        | `TabModeIcon`, `apps/live/components/chrome/editor-mode/`                                                                                                                                                                          |
| Each mode's mark                | `EDITOR_MODE_ICONS` (`packages/ui/src/icons/drawing-kinds.tsx`), one per mode, Workshop's `FlipchartIcon`, read straight by the chip, the menu rows and the pill                                                                   |
| A template's opening mode       | `templateOpensIn(overrides)`, `apps/live/app/document/[id]/useTemplateFlow.ts`                                                                                                                                                     |
| The tool a mode starts with     | `modeDefaultTool(mode, mobile)`, `useModeDefaultTool`, `PLAN_LEFT_OUT_TOOLS`, `apps/live/hooks/editor/useModeDefaultTool.ts`                                                                                                       |
| A new tab's seed                | `newTabSeed(source)`, `newTabOpening(creatorMode, mode?)`, `apps/live/lib/new-tab-seed.ts`                                                                                                                                         |
| A text box's sizing             | `TextElement.sizing?: TextSizing` (`'fit' \| 'wrap'`), absent = a fixed box                                                                                                                                                        |
| Ink by name                     | `INK_PEN_COLOUR` (`'ink'`), a `PenColourName`, drawn in `PEN_INK`                                                                                                                                                                  |
| Legacy whiteboard migration     | `migrateWhiteboardKind(tab)`, `packages/document/src/legacy-whiteboard-tab.ts`                                                                                                                                                     |
| Legacy text migration           | `migrateLegacyTextSizing(elements)`, `packages/document/src/legacy-text-sizing.ts`                                                                                                                                                 |

"Editor mode" in code and specs; the interface says Sketch, Structured and Pages (stored `draw`, `diagram`, `pages`). "Whiteboard" names the
activity, the template and Sketch mode's dock (`useWhiteboard`, `WhiteboardDock`), never a tab kind.

## Constants and configuration

| Constant                   | Value                                                                                                                                                                                                            | Where / provenance                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `EDITOR_MODE_CATALOGUE`    | Sketch (`draw`), Structured (`diagram`), Pages, Plan (`plan`, never switchable)                                                                                                                                  | `editor-mode.ts`; spec "The mode switch"                       |
| `SWITCHABLE_EDITOR_MODES`  | `draw`, `diagram`, `pages`, in that order                                                                                                                                                                        | Spec "The mode switch" (order Sketch, Structured, Pages)       |
| `TAB_OPENING_CATALOGUE`    | Sketch, Structured, Pages, Workshop, Plan                                                                                                                                                                        | `tab-opening.ts`; templates-by-mode spec                       |
| `LEGACY_EDITOR_MODES`      | `{ illustrate: 'pages', infographic: 'pages', workshop: 'diagram', facilitate: 'diagram' }`                                                                                                                      | `editor-mode.ts`; spec "Stored modes that are no longer modes" |
| Legacy default-folder key  | `'mode:infographic'` → `'mode:pages'`                                                                                                                                                                            | `LEGACY_PLACEMENT_DEFAULT_KEYS`; spec                          |
| `DEFAULT_EDITOR_MODE`      | `'diagram'`                                                                                                                                                                                                      | Spec: `opensIn` absent = Diagram                               |
| Retired mode store key     | `livedoc:v2:editor-mode:<tabId>`                                                                                                                                                                                 | Per-person era; never read or written now                      |
| `PEN_INK`                  | `#1c1917` light, `#e2e8f0` dark                                                                                                                                                                                  | `pen-colours.ts`; spec "Ink is one colour"                     |
| `WHITEBOARD_UNSET_PATTERN` | `'blank'`                                                                                                                                                                                                        | Written on a migrated board with no pattern                    |
| `WHITEBOARD_INKED_SHAPES`  | square, circle, triangle, diamond                                                                                                                                                                                | The shapes a migrated board inks                               |
| Shift+D                    | Sketch → Structured → Pages → Sketch; `hooks/editor/editor-mode-shortcut.test.ts`, e2e "Shift+D moves an empty tab to the next mode", "a drawn-on tab changes mode beside the menu button and keeps its strokes" |
| `MODE_MENU_WIDTH`          | 220 px                                                                                                                                                                                                           | `ModeMenu`; mock-up B (plans/assets/0012-mode-menu/mode-B.png) |
| `MODE_ROW`                 | 36 px tall, 6 px radius, 10 px padding across, 10 px gap, 16 px mark, 14 px check                                                                                                                                | `ModeMenu`; mock-up B, the toolbar group's menus               |
| Menu panel                 | 4 px padding, 12 px radius, `MENU_PANEL` surface                                                                                                                                                                 | `@livedoc/ui` `MENU_PANEL`; mock-up B                          |
| `LEGACY_WHITEBOARD_KIND`   | `'whiteboard'`                                                                                                                                                                                                   | The stored kind read as a Draw-opening tab                     |

A further mode is one catalogue entry plus its icon in `EDITOR_MODE_ICONS`
(`Record<EditorMode, …>`, so the typecheck names the missing icon).

## Behaviour and state

### The tab's mode

`resolveEditorMode({ tab, canEdit })` (pure, `editor-mode-store.ts`):

1. `mode = opensInOf(tab)`: the tab's own mode, the same for everyone; Structured (`'diagram'`) when absent, on a
   legacy `'workshop'` / `'facilitate'` value or on an event-storming board; `'plan'` on a Board, Sheet,
   Dashboard or Form tab and on a general tab stored `'plan'`.
2. `canSwitch = tab && editorModeSwitchable(tab) && canEdit && tab.locked !== true`, where
   `editorModeSwitchable(tab) = tabModeWritable(tab) && opensInOf(tab) !== 'plan'` and `tabModeWritable(tab)` is
   false only on an event-storming board and a Plan kind.
3. `workshop = workshopOf(tab)` and `canToggleWorkshop = canSwitch` (the same gate: an Editor, a general unlocked
   tab that is not a Plan tab).

Nothing is remembered per person: the old `livedoc:v2:editor-mode:<tab>` keys are never read
or written (left in place). Nothing is pinned per page.

- `useEditorMode(tab, { canEdit, commitTabs, toastInfo })` resolves the mode each render
  (no store, no subscription) and returns `{ mode, setMode, canSwitch, canEdit, workshop, setWorkshop }`.
- `setMode(next, alsoChange?)`: no-op unless `canSwitch`, `next` is switchable (`SWITCHABLE_EDITOR_MODES`) and
  `next !== mode`; else `track('Editor', 'Changed', MODE_EVENT[next])` first, then ONE `commitTabs` mapping the
  active tab through `switchedTab(t, next, alsoChange)`: `alsoChange` (what leaving brings, such as
  `useLeavePages`'s Turn Into Pages), then `withEditorModeSwitched`, which sets `opensIn` (`setTabOpensIn`, which
  also writes `workshop: true` for a legacy workshop value) and, entering Pages, `withContentOnAPage` ([Pages
  pages](pages-mode.md) "Into pages"). When it made a page: toast "Put onto a page that fits
  it. Undo switches back to <from>." and `Tab · Changed · PageFitToContent`. One undo step: the
  history restores the whole tab, mode included, so Undo switches back for everyone and Redo
  switches again.
- `setWorkshop(on)`: no-op unless `canSwitch` and `on !== workshop`; else `track('Editor', 'Toggled', on ?
'WorkshopOn' : 'WorkshopOff')` first, then ONE `commitTabs` mapping the active tab through `setTabWorkshop(t, on)`
  ([Workshop control blueprint](../../012-collaboration/blueprints/workshop-mode.md)).
- **The menu lists the three**: `ModeMenu` renders `SWITCHABLE_EDITOR_MODES` in order (Sketch, Structured, Pages),
  each row `menuitemradio` with `aria-checked` on the current one; choosing calls `onChange(mode)` and closes.
  Shift+D is `editorModeShortcut`: `nextEditorMode(mode)` (wrapping `SWITCHABLE_EDITOR_MODES`) while `canSwitch`,
  else null.
- **Wrappers, in order** (`useEditorState`): `rawEditorMode = useEditorMode(...)`; then
  `useLeavePages(rawEditorMode, { tab, canEdit })` (asks before leaving Pages; Turn Into
  Pages passes its conversion as `alsoChange`, so the conversion and the switch are one edit). The
  resulting `editorMode` drives the start's switch, Shift+D, the Workshop control and the canvas on the active tab.
- **Everyone follows**: a peer's switch arrives as a `tab-meta` op setting `opensIn` (or clearing
  it, back to Structured) and is applied like any tab change, so every client re-resolves the mode; a peer's toggle
  arrives the same way setting or clearing `workshop`.
  `useRoomConnection` also reads a switch with `peerModeSwitchOf(op)` and calls
  `receivePeerModeSwitch(name, tabId, mode)` with the sender's presence name
  (`nameByPresenceRef`, null when unknown); the editor toasts `peerModeSwitchMessage` when
  `tabId` is the active tab. A toggle has no toast. An inline text edit stays open across the switch, so nothing
  typed is lost (browser-checked).
- **One `canEdit`**: `useViewPreview` returns `canEdit = sessionRole === 'edit' && !previewing`.
  `useEditorState` derives `isReadOnly = !canEdit` and resolves the mode once with it;
  `EditorView` provides that `EditorModeState` (`EditorModeProvider value={ctx.editorMode}`)
  and every switch reads it through `useEditorModeState()`, so a switch and the canvas cannot
  disagree. `TabModeIcon` draws `opensInOf(tab)` for its own tab (a Plan kind its kind's glyph, the Plan start the
  board mark).

### Opening mode

- `opensInOf(tab)`: as above; `parseEditorMode(tab.opensIn)` maps the legacy names (`illustrate`, `infographic` →
  `pages`; `workshop`, `facilitate` → `diagram`). `creationIntentOf` and `readCreationIntent` read what a document
  was made as with `parseTabOpening` (`workshop` kept as itself).
- `setTabOpensIn(tab, mode)`: the same tab when `!tabModeWritable(tab)` or nothing changes; else
  `{ ...tab, opensIn: mode }` (written explicitly, Structured included), plus `workshop: true` when the stored
  value was a legacy workshop one.
- **New tab** (`useTabActions.addTab(choice = 'tab')`, `AddTabChoice` `'tab' | 'board' | 'sheet' | 'dashboard'`):
  `newTabSeed(activeTab)` copies the source tab's look and never an `opensIn`; `newTabOpening(activeTab, choice)`
  (new-tab-seed.ts) decides the rest:
  - `'tab'`: `{ opensIn }` the active tab's mode when it is switchable and not Structured (Sketch, Pages), nothing
    for Structured, a Plan tab or an event-storming board; plus `workshop: true` when `workshopOf(activeTab)`.
  - `'board' | 'sheet' | 'dashboard'`: `{ opensIn: 'plan' }`, and `setPlanStartLanding(tab.id, PLAN_START_LANDING[choice])`
    (`apps/live/lib/plan-start-landing.ts`: `'boards' | 'sheets' | 'dashboards'`), read once by `StartPlanning` as
    its `initialCategory`.
  - Telemetry: `Tab · Created` (no type) for `'tab'`; `Tab · Created · Board / Sheet / Dashboard` for the others.
    The new tab's own start shows (Start Sketching, Start Diagramming, Start a Workshop, Start Making Pages, Start
    Planning). `addTab` returns before anything when `!canEditStructure` (a Participant, a Viewer, a tab-scoped
    link). A template chosen for it then decides (`useTemplateFlow`): `templateOpensIn(overrides)` is
    `overrides.opensIn` when set, else `undefined` for an event-storming template (`overrides.kind` set), else
    `'diagram'` (Blank included), and `overrides.workshop` is written with it (absent clears it). A new document's
    first tab takes the same `templateCanvasOverrides` on `/new`, so it too opens as its template does.
- **Templates, MCP, imports**: `templateCanvasOverrides(kind)` writes, from `templateOpening(kind)`,
  `opensIn: openingEditorMode(o)` for every template not in Structured and `workshop: true` for a Workshop one
  (`template-modes.ts`; `'whiteboard'`
  → `{ opensIn: 'draw', backgroundPattern: 'graph' }`; the Pages ones also their `pages`),
  used by the picker, `/new` and the MCP `buildTemplateTab`; the
  board-scene `tabPatchOf` (whiteboard profile) and `importBoardsAsDocuments` write
  `opensIn: 'draw'`; `mergeImportedTab` carries `opensIn` (imported wins).

### Gates

Every tool and rule that the tab kind once decided keys on the effective mode (`drawMode =
editorMode.mode === 'draw'` in `useEditorState`, `editorMode` prop on `Canvas`):

| Gate                                                  | Reads                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Dock model, its keys, pen cursor, eraser mode         | `useWhiteboard({ drawMode })`                                 |
| Strip, tool panels hidden; dock or Palette Draw tools | `Canvas.editorMode` → `CanvasChrome`, `useCanvasChromePanels` |
| Still canvas: no pop-in, picking by the drawn outline | `CanvasStillProvider still`                                   |
| Type-to-edit only on notes and text                   | `useSelectionEditing({ drawMode })`                           |
| Draw style memory scope (`board:`)                    | `useStyleMemory({ board: drawMode })`                         |
| Quick style board rows                                | `useQuickStyle({ drawMode })`                                 |
| Drawn shapes unpainted, Ink; sticky opens for typing  | `useShapeDrawing({ drawMode })`                               |
| Text box placement writes `sizing`                    | `buildDrawnBoxed(..., drawMode)`                              |
| Paste and import-into-tab profile                     | `useBoardSceneInsert`, `useBoardSceneImport`                  |
| Command palette hides the format painter              | `useEditorCommands` (`ctx.editorMode`)                        |
| Empty-canvas and theme-mode banners hidden            | `EditorView`                                                  |
| The person's Draw pattern                             | `resolveViewBackdrop(tab, { mode, drawPattern })`             |

Content rules never read the mode: text hugging keys on `sizing` (`hugsText(el)` in
`apps/live/lib/text-hug.ts`), for the canvas render (`useTextHug`), label commit, style setters,
resize (`resizedElement`) and landed text (`hugLandedText`).

### Entering and leaving Sketch mode

`useWhiteboard`'s effect keys on `<tabId>:<drawMode>` and remembers the previous mode:

- Leaving Draw: a Draw-only intent (`isWhiteboardOnlyIntent`: pen, Path tool, dock shape) is
  cancelled; on a switch, a held eraser becomes Select.
- Entering Draw (a tab opened in Draw or a switch into it): on a switch a palette-armed
  intent is cancelled (a Highlighter arm among them); a held format painter, and on a switch the eraser, become
  Select; then, unless edits are blocked or a Draw intent is held, an empty tab gets the active
  pen in hand and a tab with content keeps Select.

### Text box sizing

- Placement in Sketch mode (`placedTextBox`): a tap writes `sizing: 'fit'`, a drag `'wrap'`.
- `hugResizedText`: a side or corner handle without Shift sets `sizing: 'wrap'` and the width;
  top and bottom handles and Shift keep the sizing; Shift scales `textScale`.
- A fixed box (no `sizing`) takes resize bounds as they are and is never hugged.
- A hugging box left empty on commit is removed (`hugCommittedText` → null).

## Interfaces and contracts

```ts
export type EditorMode = 'draw' | 'diagram' | 'pages' | 'plan';
export type SwitchableEditorMode = Exclude<EditorMode, 'plan'>;
export const SWITCHABLE_EDITOR_MODES: readonly SwitchableEditorMode[]; // ['draw', 'diagram', 'pages']
export function parseEditorMode(v: unknown): EditorMode | undefined;
export function editorModeLabel(mode: EditorMode): string; // 'Sketch', 'Structured', 'Pages', 'Plan'
export function nextEditorMode(mode: EditorMode, step?: 1 | -1): SwitchableEditorMode;
export function tabModeWritable(tab: ModeTab | undefined): boolean;
export function editorModeSwitchable(tab: ModeTab | undefined): boolean;
export function workshopOf(tab: ModeTab | undefined): boolean;
export function setTabWorkshop<T extends ModeTab & { id: string }>(tab: T, on: boolean): T;
export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
  workshop: boolean;
  setWorkshop: (on: boolean) => void;
};
export function useEditorMode(
  tab: (EditorModeTab & Pick<Tab, 'elements'>) | undefined,
  o: {
    canEdit: boolean;
    commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
    toastInfo: (message: string) => void;
  },
): EditorModeState;
export function withEditorModeSwitched<T extends Tab>(
  tab: T,
  mode: EditorMode,
): { tab: T; pagedContent: boolean };
export function peerModeSwitchOf(op: RoomOp): { tabId: string; mode: EditorMode } | null;
export function newTabSeed(source: Tab | undefined): Partial<Tab>;
export type AddTabChoice = 'tab' | 'board' | 'sheet' | 'dashboard';
export function newTabOpening(
  source: Tab | undefined,
  choice: AddTabChoice,
): Pick<Tab, 'opensIn' | 'workshop'>;
export function editorModeShortcut(
  s: EditorModeState,
  announce: (m: string) => void,
): (() => void) | null;
```

- `EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'workshop' | 'layers' | 'locked'>`.
- `StartModeSwitch()`: reads `useEditorModeState()` and renders nothing outside a provider, when `!canEdit` or
  `!canSwitch`; else `data-start-mode-switch` around `ModeMenuChip({ mode, onChange })`, each change inside a
  `start-mode` view transition. `StartPlanning` renders no lead.
- `EditorModeSwitch({ iconOnly })` (`components/chrome/editor-mode/EditorModeSwitch.tsx`): the same visibility as
  `StartModeSwitch` (`canEdit && canSwitch`), `data-editor-mode-switch` around
  `ModeMenuChip({ ..., compact: true, iconOnly })`, sized to its content (`flex shrink-0`). `ToolbarExplorerButton`
  renders it right after the menu button, `iconOnly` on a phone or `inline`.
- `ModeMenuChip({ mode, onChange, compact?, iconOnly? })`: shows the icon, the name (not when `iconOnly`) and a
  chevron, is named "Tab mode: <Label>" on a rail and "Editor mode: <Label>" when `compact`, carries
  `aria-keyshortcuts="Shift+D"` and `data-mode-switch` (the Leave Pages card's anchor, `LeavePagesConfirm`). Its
  outside-press check counts a press inside `[data-mode-menu]` (the portalled menu) as inside.
- The editor marks the open tab's mode as `data-editor-mode` on its column (`EditorView`), and the Workshop
  control as `data-workshop="on"` while on, for the e2e helpers.
- `ModeMenu({ mode, chip, initialFocus, hostZoom, onChange, onClose })` (`ModeMenu.tsx`), opened by
  `ModeMenuChip`: one `role="menu"` panel (`data-mode-menu`, `MODE_MENU_WIDTH` 220 px, or the chip's width when
  wider) of `SWITCHABLE_EDITOR_MODES` rows (`MODE_ROW` 36 px, 6 px radius). Rows: `menuitemradio`,
  `data-mode-row`, `aria-checked` on the current mode, its `EDITOR_MODE_ICONS` mark (16 px), its name, then
  `CheckIcon` (14 px, brand) on the current row only. Choosing (a click, or Enter / Space through `useMenu`'s
  activate) closes, then calls `onChange` unless the row is the current one. No preview, no descriptions, no tints.
- Placement: only on a start panel's rail (`StartFromTemplates`), never in `ToolbarExplorerButton`'s menu, the
  `TabPortalMenu`, the tab list or the `Explorer`.
- `TabModeIcon({ tab, style? })`: its mode's `EDITOR_MODE_ICONS` entry (a Board, Sheet, Dashboard or Form tab: its
  kind's icon; the Plan start: `EDITOR_MODE_ICONS.plan`), 12 px, `aria-hidden`; `TabListRow` passes
  `style={{ color: legibleTabAccent(tab, isDark) }}`.
- `templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined`.
- Wire: `Tab.opensIn`, `Tab.workshop` and `TextElement.sizing` are in the OpenAPI schema (`EditorMode` keeps
  `'workshop'` as an accepted stored value, read as Structured with the control on); `TabKind` is unchanged.
- Validation: `isValidElement` accepts `sizing` of `fit` or `wrap` only and `penColour` /
  `penTextColour` of a `PenColourName`, `'ink'` included; `isValidTab` leaves `opensIn` to
  `opensInOf`, which reads anything else as Structured, and accepts `workshop` only as `true` (anything else is
  dropped by `parseTabWorkshop`).

## Data and persistence

| Field / key                          | Class                  | Notes                                                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Tab.opensIn`                        | Document, synced       | The tab's mode, the same for everyone. Absent = Structured; written by templates, imports and an editor's switch (one undo step; never a new tab); `'infographic'` read as Pages and `'workshop'` as Structured with the control on, never rewritten on read |
| `Tab.workshop`                       | Document, synced       | `true` while the Workshop control is on, absent while off; written by the control and templates (one undo step); copied by a new tab from its source and by Duplicate                                                                                        |
| Per-person mode (retired)            | Device-local           | `livedoc:v2:editor-mode:<tab>` keys from before the shared mode: left in place, never read                                                                                                                                                                   |
| `drawPattern`                        | Synced user preference | The person's Draw pattern, Grid until chosen                                                                                                                                                                                                                 |
| `TextElement.sizing`                 | Document               | Replaces `autoWidth`                                                                                                                                                                                                                                         |
| `penColour` / `penTextColour: 'ink'` | Document               | Ink by name                                                                                                                                                                                                                                                  |

Migration on read, in every entry point (`migrateStoredTab` / `migrateIncomingTab`: api
`rowToTab`, thumbnails, offline store, file import, realtime ops, api writes), never in
`stampTabKind`:

- `migrateWhiteboardKind`: `kind: 'whiteboard'` → `kind: 'diagram'`, `opensIn: 'draw'`, an unset
  `backgroundPattern` → `'blank'`. Elements: an inked shape with no outline gets
  `penColour: 'ink'`, no fill → `fillColor: 'transparent'`, no label colour →
  `penTextColour: 'ink'`; a path gets Ink and no fill; an arrow Ink; a non-highlighter stroke
  loses a fill it never showed; a text box gets `sizing` (`'fit'` for `autoWidth: true`, else
  `'wrap'`). Logs `[editor-mode] whiteboard tab migrated to Draw { tabId, inked }`.
- `migrateLegacyTextSizing` (in `migrateStoredElements`): `autoWidth: true` → `sizing: 'fit'`,
  `autoWidth: false` dropped; a stored `sizing` wins.
- Telemetry history: D1 migration `apps/api/migrations/0061_draw_telemetry.sql` renames the
  `Whiteboard` category to `Draw`.

## Errors and edge cases

| Case                                                                      | Handling                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A key from the per-person era in storage                                  | Never read; the tab's mode wins                                                              |
| A peer's op with no presence name yet                                     | The toast says "Someone"                                                                     |
| Undo or redo across a switch                                              | The snapshot restores `opensIn`; everyone moves to that mode, no toast for the one who undid |
| Forged `opensIn` on an event-storming board                               | `opensInOf` → Structured; `setTabOpensIn` returns the tab                                    |
| Unknown `opensIn` value                                                   | Read as Structured                                                                           |
| Legacy `opensIn: 'infographic'`                                           | Read as Pages (`parseEditorMode`); not rewritten                                             |
| Switch by a visitor, on a locked tab or ES board                          | `setMode` returns early: nothing written, no telemetry                                       |
| Switch to the mode the tab is in                                          | No commit                                                                                    |
| Shift+D on a Plan tab, a locked tab or for a non-Editor                   | `canSwitch` false: the shortcut is null, the key does nothing                                |
| A locked row in a session that cannot add tabs                            | Inert (`aria-disabled`): no question, no new tab                                             |
| A Plan tab (a Plan kind, or a general tab stored `plan`)                  | No switch, no Workshop control; the pill shows its kind or the board mark                    |
| A stored `opensIn: 'workshop'` (or `facilitate`)                          | Read as Structured with the control on; the next switch or toggle writes both as they are    |
| `workshop` set on an event-storming board or a Plan tab (forged or stale) | `workshopOf` false; `setTabWorkshop` returns the tab                                         |
| A peer switches while I type in a label                                   | The editor stays open; the text commits as usual; a toast names the peer                     |
| Previewing as a viewer                                                    | `canEdit` false: no switch, the tab's mode, read-only                                        |
| Event-storming board, or outside an editor                                | Neither switch renders; the pill icon shows Structured                                       |
| A tab switched while a paste's images upload                              | The paste is dropped (unchanged board-scene rule)                                            |
| Stale client sends a `Whiteboard` telemetry event                         | Refused by the closed category list                                                          |

## Security and trust

- The mode is presentation: the api never reads it; edits stay guarded by role and lock.
- `opensIn` arrives untrusted; it is never validated as an enum because every reader goes through
  `opensInOf`, which cannot yield anything but a mode.
- A switch writes `opensIn` only for an editor (`canEdit`) on an unlocked, switchable tab, as one
  commit; the room enforces the edit role on its sync like any tab edit. A forged `opensIn` from a
  peer can only ever read as a mode (`opensInOf`). The peer toast names the sender by their
  presence name, never by anything in the op.
- Telemetry carries the mode name only, never a tab or document id.

## Performance and limits

- The mode resolves per render from the tab (`opensInOf`): no store, no subscription, no storage
  read.
- A switch is one commit; entering Pages adds `withContentOnAPage`, O(elements) (measured
  1.4 ms at 3000 elements, [Pages blueprint](pages-mode.md) "Performance and
  limits"). The sync is one small `tab-meta` op (`opensIn`, plus `pages` entering Pages).
- Migration returns the same tab and element objects when nothing changes (identity-preserving).

## Presentation and UX

- The chip (`ModeMenuChip`): a full-bleed `h-12` row at the top of the rail, the mode's icon, its name and a chevron
  on `TOOLBAR_TRIGGER_TONE`, its focus ring drawn inside. No hover card (it would cover the menu). The menu opens
  downward (`absolute top-full mt-1.5 left-0`), spanning the panel under `sm`. The menu opens at design size: on
  opening, the chip reads its host's effective zoom (`effectiveZoom`: `currentCSSZoom`, else screen width over
  layout width) and the menu sets `zoom: 1 / hostZoom`, undoing the panel UI scale ([UI scale](../ui-scale.md)).
  The same for everyone: power user mode does not change it.
- The compact chip (`compact`, beside the menu button): `h-9 rounded-md px-2 gap-1.5`, the brand focus outline, its
  name in `text-optical-line`; `iconOnly` drops the name. Its menu (`fill` false) mounts in a `Portal`, `fixed` at the
  chip's bottom + 6 px and its left clamped to `[POPOVER_VIEWPORT_MARGIN, innerWidth - width - margin]`, measured in a
  layout effect and on resize, `visibility: hidden` until measured; a portal draws unscaled, so no zoom undoing.
- The Draw dock at the top keeps 8 px clear of the top line's side groups, measured (`useDockLinePlacement`,
  `--dock-clear`), the old `7.5rem` / `4.125rem` offsets as fallbacks until measured.
- The tab pill leads with `TabModeIcon` (in place of the accent dot), tinted with the tab's
  accent.
- No Mode section in the tab menu.
- No other cue marks the mode (spec "No further cue").

## Accessibility

- Chip: `aria-haspopup="menu"`, `aria-expanded`, `aria-keyshortcuts="Shift+D"`, named
  "Tab mode: <Label>"; ↑/↓ on the chip open the menu. Rows `menuitemradio` with
  `aria-checked`, focus on the checked row on opening; ↑/↓ wrap, Home/End, Enter/Space, Escape
  return focus to the chip. Tab away closes the menu: a blur closes it only when focus moves to
  another element outside it (`relatedTarget` set); a blur to nowhere is a press (Safari does not
  focus a pressed button), so the row's click still lands. A press outside is
  `useClickOutside`'s. The tab pill's icon is `aria-hidden`.
- Shift+D carries `aria-keyshortcuts`; a switch by key is announced politely
  (`announce('Sketch mode')`). The key obeys the character-key shortcuts setting.
- Focus rings `MODE_SWITCH_FOCUS` (brand-600 light, brand-400 dark, at least 3:1).

## Web Experience

- CLS: the switch fills its row on the start's rail, so nothing beside it moves on a switch, and the menu card at
  the top left no longer holds it, so it never changes width with the tab.
- INP: a switch is one commit (and, entering Pages, one linear pass over the elements); no
  fetch, no remount of the canvas.
- LCP: unaffected; the mode resolves synchronously on first render from the tab.

## Observability

| Event / log                                                                     | Where                                |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `Editor · Changed · ModeDraw / ModeDiagram / ModePages`                         | `useEditorMode.setMode`              |
| `Editor · Toggled · WorkshopOn / WorkshopOff`                                   | `useEditorMode.setWorkshop`          |
| `Tab · Created` (· `Board` / `Sheet` / `Dashboard`), `UI · Opened · AddTabMenu` | `useTabActions.addTab`, `AddTabMenu` |
| `Editor · Changed · LeavePagesConfirmed`                                        | `useLeavePages`                      |
| `Tab · Changed · PageFitToContent` and its toast                                | `useEditorMode.setMode`              |
| `Draw · …` (formerly `Whiteboard`)                                              | Sketch mode's emitters               |
| `[editor-mode] switched { tabId, from, to, paged }` (debugLog)                  | `setMode`                            |
| `[editor-mode] whiteboard tab migrated to Draw`                                 | `migrateWhiteboardKind`              |
| `<Name> switched this tab to <Mode>.` (toast)                                   | `receivePeerModeSwitch`              |

## Testing

| Spec rule                                                                      | Test                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modes, catalogue, opening mode, ES no switch                                   | `packages/document/src/editor-mode.test.ts` ("are Sketch, Structured and Pages to switch, Structured by default", "draws the page in Pages mode only")                                                                                                                                           |
| Stored whiteboard → general tab in Draw, inked                                 | `legacy-whiteboard-tab.test.ts`, `stored-tab.test.ts`, api `tab-row.test.ts`                                                                                                                                                                                                                     |
| `autoWidth` → `sizing`                                                         | `legacy-text-sizing.test.ts`, `validate.test.ts`                                                                                                                                                                                                                                                 |
| The tab's mode for everyone; view role; lock; ES                               | `apps/live/lib/editor-mode-store.test.ts`, `hooks/editor/useEditorMode.test.tsx`                                                                                                                                                                                                                 |
| A switch is one tab edit, with its page                                        | `useEditorMode.test.tsx`, `packages/document/src/editor-mode-switch.test.ts`, `hooks/editor/useLeavePages.test.ts`                                                                                                                                                                               |
| One `canEdit`; preview hides the switch                                        | `useViewPreview.test.tsx`, `components/start/StartModeSwitch.menu.test.tsx`                                                                                                                                                                                                                      |
| The switch: named, menu below, rows, keys                                      | `StartModeSwitch.menu.test.tsx` "StartModeSwitch chip", `StartModeSwitch.test.tsx`, `ModeMenu.test.tsx`                                                                                                                                                                                          |
| A pressed row lands; Tab away closes                                           | `StartModeSwitch.menu.test.tsx` "keeps the menu open through a blur to nowhere…", "closes when focus moves outside (Tab away)"                                                                                                                                                                   |
| The switch beside the menu button; the two agree; none in the tab menu         | `components/chrome/editor-mode/EditorModeSwitch.test.tsx`, `components/chrome/ToolbarExplorerButton.test.tsx` "carries the editor mode switch right after the menu button", e2e `editor-modes.spec.ts` "the switch beside the menu button agrees with the start's, and the tab menu offers none" |
| A Draw tool in hand never takes the press                                      | `ToolbarExplorerButton.test.tsx` "marks its card as floating chrome…"                                                                                                                                                                                                                            |
| The tab list rows show the tab's mode                                          | `components/chrome/lines/TabList.test.tsx`, `components/chrome/editor-mode/TabModeIcon.test.tsx`                                                                                                                                                                                                 |
| A template decides the tab's mode                                              | `app/document/[id]/useTemplateFlow.test.ts`                                                                                                                                                                                                                                                      |
| A peer's switch is followed and named                                          | `lib/peer-mode-switch.test.ts`, e2e `editor-modes.spec.ts` "the start's switch changes the tab for everyone, and Undo switches it back"                                                                                                                                                          |
| The plain menu: three rows, check on current, keys; no switch on a Plan tab    | `ModeMenu.test.tsx`, `EditorModeSwitch.test.tsx`, `useEditorMode.test.tsx` "offers no switch on a Plan tab"                                                                                                                                                                                      |
| The add menu: Tab, Board, Sheet, Dashboard; the Plan start lands on the choice | `AddTabMenu.test.tsx`, `new-tab-seed.test.ts`, `plan-start-landing.test.ts`, `useTabActions.addTab.test.tsx`                                                                                                                                                                                     |
| Legacy workshop tabs, `setTabWorkshop`, `workshopOf`                           | `packages/document/src/editor-mode.test.ts`                                                                                                                                                                                                                                                      |
| The tool a mode starts with                                                    | `hooks/editor/useModeDefaultTool.test.ts`                                                                                                                                                                                                                                                        |
| New tab opens in its maker's mode, on its start                                | `lib/new-tab-seed.test.ts`, `hooks/persistence/useTabActions.addTab.test.tsx`, e2e `editor-modes.spec.ts` "a new tab opens in the mode it was made from"                                                                                                                                         |
| Entering / leaving Draw                                                        | `hooks/canvas/useWhiteboard.test.tsx`, `useWhiteboard.board-tools.test.tsx`                                                                                                                                                                                                                      |
| The Draw dock clears the top line's side groups                                | `components/canvas/whiteboard/dock-line-placement.test.ts`, `WhiteboardDock.test.tsx` "sits centred on its line"                                                                                                                                                                                 |
| Hugging on `sizing` in both modes                                              | `lib/text-hug.test.ts`, `boxed-drag-resolve.resize.test.ts`, `useEditorDrag.shift-resize.test.tsx`, `useTextStyleSetters.test.ts`                                                                                                                                                                |
| Template, MCP, imports open in Draw                                            | `apps/live/lib/templates.test.ts`, `packages/templates/src/template-tab.test.ts`, `lib/board-scene/land.test.ts`, `lib/import-merge.test.ts`                                                                                                                                                     |
| Telemetry rename and history                                                   | `apps/api/src/db/legacy-migration-0061.test.ts`, telemetry app suites                                                                                                                                                                                                                            |
| Shift+D                                                                        | Sketch → Structured → Pages → Sketch; `hooks/editor/editor-mode-shortcut.test.ts`, e2e "Shift+D moves an empty tab to the next mode"                                                                                                                                                             |

the Workshop control's own rules are blueprinted in
[Workshop control](../../012-collaboration/blueprints/workshop-mode.md).

Not covered by a unit test: `parseEditorMode`'s legacy name, `parsePlacementDefaultKey`, the
peer toast's wiring in `useRoomConnection`, and a label edit kept across a peer's switch (browser-checked with two windows). `addTab(choice)` for each row
is covered by `useTabActions.addTab.test.tsx` and `new-tab-seed.test.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D15 to D22, D59 and D103 to D114.
