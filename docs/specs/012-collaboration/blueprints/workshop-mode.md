# Workshop control blueprint

Derived from [Workshop control](../workshop-mode.md). The mode machinery it sits beside (store, switch, Shift+D,
peer switches, the tab's one edit) is [Editor modes](../../007-editor/blueprints/editor-modes.md); this blueprint
adds only what the control changes.

## Domain and naming

| Concept                      | Identifier                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| The control's state          | `Tab.workshop?: true` (`packages/document/src/index.ts`), read through `workshopOf(tab)`                 |
| Turning it                   | `setTabWorkshop(tab, on)` (`packages/document/src/editor-mode.ts`), `EditorModeState.setWorkshop(on)`    |
| A legacy Workshop-mode value | `isLegacyWorkshopOpensIn(v)`: `'workshop'` or `'facilitate'`                                             |
| The control                  | `WorkshopControl` (`apps/live/components/chrome/lines/WorkshopControl.tsx`), in `DocumentActions`        |
| What a template opens as     | `TabOpening` `'workshop'` (`packages/document/src/tab-opening.ts`): Structured with the control on       |
| Its mark                     | `FlipchartIcon` (`packages/ui/src/icons/drawing-kinds.tsx`), `TAB_OPENING_ICONS.workshop`                |
| The kit added to a layout    | `withWorkshopKit(layout)` (`apps/live/components/palette/palette-layouts.ts`), `WORKSHOP_KIT_CATEGORIES` |
| The strip's tools            | `sessionStripTools(mode, { workshop, esBoard })` (`apps/live/components/canvas/SessionClusterStrip.tsx`) |
| Whether the strip is a bar   | `showsCategoryBar(mode, workshop)` (`apps/live/components/palette/category-flyout-groups.ts`)            |
| Its blank                    | template kind `'blank-session'`, "Blank Session", document "Untitled Session"                            |
| Its default folder key       | `'mode:workshop'`, words `{ label: 'Sessions', noun: 'sessions' }` (`MODE_WORDS`, keyed by `TabOpening`) |

Banned in code and copy: "Workshop mode" for the control (only the history line of the spec says it), "Session
mode", "Collaborate mode". `'workshop'` is never an `EditorMode`; it survives as a `TabOpening` and as a stored
legacy `opensIn`. The facilitator (the baton) is a different thing and keeps its name. The six Collaborate
categories keep their ids: `collab-ask`, `collab-tools`, `collab-record`, `collab-react`, `collab-mode`,
`collab-navigate`.

## Constants and configuration

| Constant                              | Value                                                                                                                                                    | Provenance               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `WORKSHOP_KIT_CATEGORIES`             | `collab-ask`, `collab-tools`, `collab-record`, `collab-react`, `collab-mode`, `collab-navigate`, in that order                                           | spec "The palette"       |
| Kit placement                         | Before the layout's `icons` entry, else appended; `stickers` right after `icons` when the layout has none                                                | spec "The palette"       |
| `sessionStripTools`                   | `workshop` or `esBoard` → Timer, Vote, Poll; `plan` → Timer, Vote; `pages` → Vote, Poll `runningOnly`; else `null`                                       | spec "The Session strip" |
| `showsCategoryBar`                    | `mode === 'pages'` or (`mode === 'diagram'` and `workshop`)                                                                                              | spec "The palette"; WC2  |
| `TEMPLATE_OPENINGS` `'workshop'`      | the session templates listed in the spec, and `blank-session`                                                                                            | spec "Templates"         |
| `BLANK_TEMPLATE_FOR_OPENING.workshop` | `'blank-session'`                                                                                                                                        | spec "Templates"         |
| Hover lines                           | off: "Bring the session kit to this tab: timers, votes, polls and the Collaborate tiles."; on: "Put the session kit away. Anything on the canvas stays." | spec "The control"       |

## Behaviour and state

- **State:** `Tab.workshop` alone. `workshopOf(tab)` is `false` on an event-storming board and on any tab in
  `plan` (`opensInOf(tab) === 'plan'`); else `tab.workshop === true || isLegacyWorkshopOpensIn(tab.opensIn)`.
- **Turning:** `setTabWorkshop(tab, on)` returns the tab unchanged when `!tabModeWritable(tab)`, the tab is in
  `plan`, or `workshopOf(tab) === on`; else a copy with `workshop: true` (on) or without the key (off), and without
  a legacy workshop `opensIn` (dropped, so the tab reads Structured). `EditorModeState.setWorkshop(on)` gates on
  `canSwitch`, tracks `Editor · Toggled · WorkshopOn | WorkshopOff`, then one `commitTabs` over the active tab: one
  undo step, synced as a `tab-meta` op like the mode.
- **Switching mode keeps it:** `setTabOpensIn` leaves `workshop` alone, and writes `workshop: true` when it
  rewrites a legacy workshop `opensIn`.
- **The control:** `ActionsGroup` passes `workshop={{ on, onToggle }}` to `DocumentActions` only when
  `editorMode.canSwitch` (an Editor, a general unlocked tab, not in `plan`, not an event-storming board) and the
  document actions show. `WorkshopControl` renders the group's flat button (`TOOLBAR_BUTTON`), `aria-pressed={on}`,
  `data-workshop-control`, the `FlipchartIcon` (14 px) and "Workshop" (`phone:sr-only`), the `SHARED` brand fill
  while on, in a `HoverCard` titled "Workshop".
- **Palette:** `paletteCategoriesFor(mode, { esBoard, pagesKind, workshop })` resolves `withWorkshopKit(layout)`
  when `workshop`; `paletteCategoryOffered(mode, id, workshop)` likewise. The palette's chosen category re-lands on
  the layout's `landing` when the category on show is no longer offered (existing re-land on a change of the
  offered list).
- **Strip:** `CanvasChrome` mounts the Session strip when `sessionStripTools(mode, { workshop, esBoard })` is
  non-null; `useCanvasChromePanels` closes a session popover whose tool the tab no longer offers.
- **Category bar:** `CategoryBarStrip` shows when `showsCategoryBar(mode, workshop)`, gathering `collab-tools` to
  `collab-navigate` into `session` as it did for Workshop mode.
- **Start:** `templateStartMode({ ..., workshop })` returns `'workshop'` for an empty Structured tab with the
  control on; the start's closed key is `<tab id>:workshop`.
- **Tour:** `EditorTours` mounts `WorkshopTourHost` once `workshop` has been true; the host offers the tour while
  `workshop` is on and ends it as skipped when it goes off.
- **New tab and Duplicate:** `newTabOpening(source, 'tab')` copies `workshop: true` from `workshopOf(source)`;
  Duplicate copies the tab whole.
- **Templates:** `templateCanvasOverrides(kind)` writes `workshop: true` when `templateOpening(kind) === 'workshop'`,
  and `opensIn` from `openingEditorMode` (Structured: absent).

## Interfaces and contracts

```ts
export function workshopOf(tab: ModeTab | undefined): boolean;
export function setTabWorkshop<T extends ModeTab & { id: string }>(tab: T, on: boolean): T;
export function isLegacyWorkshopOpensIn(v: unknown): boolean;
export function sessionStripTools(
  mode: EditorMode,
  o: { workshop: boolean; esBoard: boolean },
): SessionStripTools | null;
export function showsCategoryBar(mode: EditorMode, workshop: boolean): boolean;
export function withWorkshopKit(layout: PaletteLayout): PaletteLayout;
export function WorkshopControl(p: {
  on: boolean;
  onToggle: () => void;
  labelled?: boolean;
}): JSX.Element;
```

- `ModeTab` gains `workshop?: unknown` (a stored value of any shape is read through `workshopOf`).
- `Tab.workshop?: true` is in the OpenAPI schema; `isValidTab` keeps it only when `true` (`parseTabWorkshop`).
- Every `Record<EditorMode, …>` loses its `workshop` entry; a map of what a template or document is made as is
  keyed by `TabOpening` instead (`MODE_WORDS`, `BLANK_TEMPLATE_FOR_OPENING`, `POPULAR_BY_OPENING`, the template
  filter's events and counts, the New Document wizard's pitches, explorer `VALUE_LABELS['opens-in']`).

## Data and persistence

- `workshop: true` is stored on the tab body and synced as tab metadata, like `opensIn`. Absent means off.
- No migration of stored bodies: a legacy `opensIn: 'workshop'` reads as on (`workshopOf`) and Structured
  (`opensInOf`); the first write of the mode or the control normalises it.
- An older client reading `workshop: true` ignores it (unknown field) and reads `opensIn` as before; a tab it last
  wrote keeps the field (tab bodies round-trip unknown fields).
- Creation intents and tab stats keep `'workshop'` as a `TabOpening` (`tabOpeningOf(tab)`: `'workshop'` for a
  Structured tab with the control on).

## Errors and edge cases

| Case                                                       | Handling                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `workshop: true` on an event-storming board or a Plan tab  | `workshopOf` false; the control is not offered; `setTabWorkshop` returns the tab |
| A session button pressed with the control off              | Starts its tool as before; no strip in Structured or Sketch (spec)               |
| A strip popover open when the control goes off             | Closes (`useCanvasChromePanels` re-check)                                        |
| The palette shows a kit category when the control goes off | Re-lands on the layout's landing                                                 |
| A peer turns it off mid-tour                               | The tour ends as skipped                                                         |
| Locked tab                                                 | No control for anyone; a stored state still shows its kit                        |
| `/new?mode=workshop`                                       | `parseTabOpening` → `'workshop'`; Blank Session                                  |
| `workshop` not `true` (forged `1`, `"yes"`)                | Dropped by `parseTabWorkshop` on write; `workshopOf` reads only `true`           |

## Security and trust

- No new trust boundary. The field is a tab-metadata write, accepted from an editor only as every tab-meta op is
  (the room drops view-role tab writes); the control is shown only where `canSwitch` (`can.level === 'edit'`, not
  locked). A forged value is reduced to `true` or absent by `parseTabWorkshop`.

## Performance and limits

- `withWorkshopKit` is a pure map over at most 25 layout entries, memoised per `(mode, pagesKind, workshop)`;
  under 0.1 ms. No new request, no new chunk: the control is a button in an already-loaded group.

## Presentation and UX

- The control: the actions group's flat button, 36 px tall, label fixed ("Workshop"), the brand fill while on;
  turning it moves nothing in the group (no layout shift).
- Copy: name "Workshop"; hover lines above; no toast.

## Accessibility

- A `button` with `aria-pressed`; its accessible name "Workshop" (the visible label, `sr-only` on a phone); the
  icon `aria-hidden`. The brand fill's white text is 5.9:1 (brand-700); the focus ring is the group's (3:1 or more).
  Nothing animates beyond the group's colour transition, which reduced motion leaves instant.

## Web Experience

- No LCP or CLS cost: the button renders with the group; its presence depends on the role and tab known at first
  paint. INP: one tab edit, the same work as a mode switch.

## Assets and external resources

- `FlipchartIcon`: hand-authored SVG path in `packages/ui/src/icons/drawing-kinds.tsx` (MIT, this repo), now
  `TAB_OPENING_ICONS.workshop` and the control's mark.
- `blank-session` preview: hand-authored SVG in `packages/template-previews/src/template-preview-16.tsx`.
- The help card glyph for the article (`/help/canvas/workshop/`) in `apps/help/lib/featureIcons.tsx` and its hue in
  `featureColours.ts`, moved from `workshop-mode`.

## Observability

- Telemetry: `Editor · Toggled · WorkshopOn / WorkshopOff`, `UI · Toggled · TemplateModeWorkshop`, each with an
  explanation sentence in `apps/telemetry/app/event-explanations.ts`. Log `[workshop] control turned { tabId, on }`
  at `info` from `setWorkshop`, and `[workshop] legacy tab read as Structured with the control on { tabId }` once
  per tab per session from the editor's mode resolution.

## Testing

| Spec rule                                                        | Test                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `workshopOf`, `setTabWorkshop`, legacy values, Plan / ES tabs    | `packages/document/src/editor-mode.test.ts`                                   |
| One undo step, telemetry, gated on `canSwitch`                   | `hooks/editor/useEditorMode.test.tsx`                                         |
| The control: pressed state, label, offered only to an Editor     | `components/chrome/lines/WorkshopControl.test.tsx`, `ActionsGroup.test.tsx`   |
| Kit added to each layout; Popular unchanged                      | `components/palette/palette-layouts.test.ts`                                  |
| Category bar in Structured with the control on                   | `components/palette/category-flyout-groups.test.ts`                           |
| Strip per mode and control                                       | `components/canvas/SessionClusterStrip.test.tsx`                              |
| Start a Workshop for an empty Structured tab with the control on | `components/start/template-start-mode.test.ts`                                |
| Templates open with the control on; blank                        | `packages/templates/src/template-canvas-overrides.test.ts`, `popular.test.ts` |
| New tab takes the control                                        | `lib/new-tab-seed.test.ts`                                                    |
| End to end: on and off in each mode, a viewer, a phone           | `e2e/workshop-control.spec.ts`                                                |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows WC1 to WC6.
