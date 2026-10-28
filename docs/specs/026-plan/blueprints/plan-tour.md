# Plan tour blueprint

Derived from [Plan tour](../plan-tour.md). The engine, stage, popover, spotlight, shield, tour colours and the
actions group's Start Tour button live once in `apps/live/components/tour`
([Diagram tour](../../007-editor/editor-tour.md)), shared rather than copied.

## Domain and naming

| Spec term    | Identifier                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Plan tour    | `PlanTourHost`, `planTourSteps(track)`, `planTourStepTelemetryType`                                                |
| tour track   | `BoardSheetTrack` (`'boards' \| 'sheets'`), of `PLAN_TOUR_TRACKS`                                                  |
| offer        | `useOfferTour('plan', …)` (`tour-offer.ts`): the track the actions group's Start Tour button names, `offerTrack`   |
| tour subject | `Subject` (`{ boardId, sheetId }`, element ids) in `PlanTourHost`, fixed at a press by `visiblePlanWork`           |
| plan work    | `plan-board` / `plan-sheet` shape elements on `activeTab.elements` (`isBoard`, `isSheet`)                          |
| example card | The Boards track's own card: `TOUR_CARD_TITLE` (`'Your First Card'`), held in `tourCardRef` in `PlanTourHost`      |
| leftovers    | `PlanTourContent` and its leftover record, swept by `usePlanTourLeftovers` (the example card's, and an old tour's) |
| seen guard   | `UserPreferences.planTourTracks` (the answered tracks), read by `planTrackSeen`                                    |

## Files

| File                                            | Holds                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/components/tour/tour-step.ts`        | `TourStepOf<Api>` (the shared step shape), `hasAnchor`, `stepTelemetryType(prefix, id)`                                                                 |
| `apps/live/components/tour/useTourEngine.ts`    | The shared step runner: step index, direction, target rect, prepare / wait / heal                                                                       |
| `apps/live/components/tour/tour-offer.ts`       | `useOfferTour`, `TOUR_OFFER_RANK`: each host publishes its tour; the most specific one is on the button                                                 |
| `apps/live/components/tour/TourOfferButton.tsx` | The actions group's Start Tour button, leading the document actions (`ChromeControls`)                                                                  |
| `apps/live/components/tour/TourStage.tsx`       | The shared overlay: highlight ring, `TourPopover`                                                                                                       |
| `apps/live/components/tour/TourPopover.tsx`     | `copy` (`TourCardCopy`): the step card, the last card included                                                                                          |
| `apps/live/components/tour/TourHost.tsx`        | The Diagram tour on the engine; publishes itself to `tour-active`                                                                                       |
| `apps/live/components/tour/plan-tour-steps.ts`  | `planTourSteps`, `BOARD_STEPS`, `SHEET_STEPS`, `PlanTourApi`, `boardRoot`, `sheetRoot`, `firstCardOn`, `visiblePlanWork`, `needsReveal`, telemetry type |
| `apps/live/components/tour/PlanTourHost.tsx`    | On the button (`useOfferTour`), subject, relaunch, end; builds `PlanTourApi`                                                                            |
| `apps/live/lib/tour-tracks.ts`                  | `tourTrackSeen`, `withTracksAnswered`: the tracks a person has taken                                                                                    |
| `apps/live/lib/tour-active.ts`                  | Which tour is on screen (`'welcome' \| 'plan' \| 'workshop' \| null`), a module store                                                                   |
| `apps/live/lib/plan-tour.ts`                    | Relaunch event, tracks, `planTrackSeen` / `markPlanTracksSeen`, the old tour's `PlanTourContent` record                                                 |
| `apps/live/hooks/plan/usePlanTourLeftovers.ts`  | The sweep of an old tour's leftover record; nothing new is placed (see Leftovers)                                                                       |

Also touched: `ClusterPopoverButton` (a `dataTourId` prop; Card Types passes `card-types`), the Settings catalogue
and dialog, `power-user-mode.ts`, `help-articles.ts`, the help article
`apps/help/app/canvas/plan-mode/plan-tour/page.mdx` with its registry entry, icon and colour, and the telemetry
dashboard (`apps/telemetry/app/catalogue/features.ts`, `apps/telemetry/app/catalogue/visitors.ts`,
`apps/telemetry/app/catalogue/settings.ts`, `apps/telemetry/app/DashboardView.tsx`,
`apps/telemetry/app/computed-emitters.ts`, `apps/telemetry/app/event-explanations.ts`).

Wiring: `useEditorState` composes `usePlanTourLeftovers` (it returns nothing); `EditorTours` mounts `<PlanTourHost />`
with the editor. `usePlanSlice` returns `showItem(id | null)`, setting the open item without `Plan` ·
`Opened`.

## Behaviour and state

### Engine (`useTourEngine`)

`useTourEngine<Api>({ steps, apiRef, onStepView, onStart, onFinish })` returns `{ active, step, stepIndex, stepDir,
targetRect, countableSteps, start, next, back, skip, stop }`:

1. `start()` sets index 0, direction forward, clears the rect, bumps the run token, `active = true`, and calls
   `onStart`. Index 0 is the track's first real step: there is no welcome card.
2. On each step entry: `onStepView(step)`; then `prepare(api)` runs for every
   step, anchored or not; an
   anchorless step then shows centred; an anchored step awaits its target (`selector(api)` when set, else the
   `data-tour-id` of `target`) for 3500 ms. No target: the step's cleanup runs and the tour moves on in the
   direction it was going (`stepDirRef`): backward to the step before unless there is none, else forward (direction set `forward`), or finishes from the last step. A found target is revealed
   (`revealInScrollers(el, step.revealAt)`, `tour-reveal.ts`: each `overflow: auto | scroll` ancestor, innermost
   first, then an unlocked page, left alone when it wholly shows the target inside a `REVEAL_MARGIN_PX` (16) margin,
   else scrolled to centre it, or to the top for `'start'` or a target taller than its scroller; `smooth`, `auto` under reduced motion), then measured.
3. Every 150 ms the target is re-measured; a detached target re-runs prepare and re-awaits (healing), revealing what
   it finds; a heal that finds nothing clears the rect, so the ring lets go and the popover centres. A target that
   only moves is followed, never re-revealed.
4. `next()`, `back()`, `skip()` run the current step's cleanup first. `next()` on the last step and `skip()`
   call `onFinish(outcome)` with `'completed'` or `'skipped'` (`TourOutcome`; there is no `'declined'`).
5. `stop()` ends without an outcome (the host ending it for its own reasons).

`TourStep<Api>` gains `selector?: (api) => string | null` and `revealAt?: 'center' | 'start'` (default center). `target` stays the data-tour-id anchor; a step has
an anchor when either is set.

### Offer (`PlanTourHost`)

The host publishes its offer with `useOfferTour('plan', offer)`, re-read every render; it never starts the tour on
its own (no settle delay, no arming).

| State   | Event                                                        | Guard                                                            | Effect                                                                               |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| idle    | render                                                       | usable, can edit, tab unlocked, has plan work                    | publish `{ name: 'Boards' \| 'Sheets', rank: TOUR_OFFER_RANK.mode, start, onShown }` |
| idle    | render                                                       | otherwise                                                        | publish `null` (the button names another tour, or is not drawn)                      |
| idle    | the button first shows this offer in a page load (`onShown`) | none                                                             | `Opened` · `PlanTourOffer`                                                           |
| idle    | a press (`start`) or relaunch event                          | not active, no other tour, `offerTrack` set (relaunch: on offer) | fix the subject, `tourTrack = offerTrack`, `start()` (sends `Started` · `PlanTour`)  |
| running | edit rights lost / another tab / subject deleted             | none                                                             | `stop()`, end as skipped                                                             |
| running | `onFinish(outcome)`                                          | none                                                             | end (below)                                                                          |

"Usable": `hydrated && !anyWelcomeOpen && !isReadOnly && !embedMode`. "No other tour": `activeTour()` is null or
`'plan'`. "Has plan work": a `plan-board` or `plan-sheet` shape on `activeTab.elements`. `offerTrack`: of the tracks
with work on the tab (Boards first), the first not `planTrackSeen` (in `planTourTracks`, or every track when
`planTourSeen` and Power user mode are both on), else the first; so a taken tour stays on offer.

At a press: `subject = { boardId: visiblePlanWork(boardIds, boardRoot), sheetId: visiblePlanWork(sheetIds, sheetRoot) }`
(of every board and Sheet on the tab: the one inside `[data-canvas-cover]`, maximised or filling its tab, else the
first whose box meets the window, else the first). "Subject deleted": `subject[tourTrack]` no longer among
`activeTab.elements`.

End: close the item panel, take the example card away (`removeTourCard`), write
`markPlanTracksSeen(prefs, [tourTrack])` (rebased onto the freshest preferences); then send `Ended` ·
`PlanTourCompleted` or `Ended` · `PlanTourSkipped`. The host's unmount takes the example card away too.

### Tracks

The engine's `steps` are `planTourSteps(tourTrack)`: that track's steps and its last card. Every board has the card
steps: the tour adds its own card to show them on. The last card's help link follows the track
(`/help/canvas/plan-mode/` or `/help/canvas/plan-mode/sheets/`). There is no welcome card and no choice card.

Boards steps, each scoped to the board's drawn body `[data-plan-board="<board>"]` (`boardRoot`; never its
`data-element-id` canvas node, hidden under a maximised or tab-filling body): `board` (no anchor, a centred card; prepare
`reveal('boards')`), `add-cards`
(prepare `addTourCard`; `[data-plan-card="<example card>"]`), `move-card` (prepare `moveTourCard`; the same card),
`card-panel` (`[role="dialog"][aria-label^="Item #"]`; prepare `openTourCard`, cleanup `closeCard`), `board-header`
(`[data-board-header]`; prepare `closeCard`), `card-types` (data-tour-id `card-types`), `outro`.

Sheets steps, each scoped to the Sheet's drawn body `[data-plan-sheet="<sheet>"]` (`sheetRoot`, on
`PlanSheetView`'s body root): `sheet` (no anchor, a centred card; prepare `reveal('sheets')`), `cells` (`[data-sheet-a1]`,
the A1 cell box `SheetCells` marks; skipped when A1 is not drawn),
`formulas` (`[data-sheet-formula-bar]`), `sheet-toolbar` (`[role="toolbar"]`), `sheet-settings`
(`button[aria-label="Sheet Settings"]`), `outro`. No other Sheets step prepares anything.

### Tour subject

`PlanTourApi` is `{ boardId(), sheetElementId(), firstCardId(), openCard(), closeCard(), addTourCard(),
moveTourCard(), openTourCard(), tourCardId(), reveal(track) }`, built fresh each render over the subject. `firstCardId` and `openCard` read `firstCardOn(boardId)`: the `data-plan-card`
of the first card drawn inside the board's body, or null. `reveal(track)` asks `needsReveal(root)` (false inside
`[data-canvas-cover]`; true when the body's box leaves the window) and, if so, calls
`scrollIntoView(x, y, width, height)` on the subject element: a minimal pan, zooming out only when it overflows. `openCard` calls `plan.showItem(id)` when that card is not already
open; `closeCard` calls `plan.closeItem()` when one is open.

The example card is the only thing the api writes, each write through `plan.writeQuiet(op, { silent: true })` (no
undo step, no content event). `addTourCard` (once per run) creates an item titled `TOUR_CARD_TITLE`, of the board's
first add type (`planBoard.addTypes[0]`, else `task`), in its first column's status, after recording it
(`writeLeftover({ documentId, elementId: '', itemIds: [id] })`); it returns its id, or null (logging `[plan-tour] card
not added` with no board setup, column or document, `[plan-tour] card refused` when the write fails, clearing the
record). `moveTourCard` moves it to the second column's status, when there is one. `openTourCard` shows it (else the
first drawn card). `removeTourCard` closes its panel, deletes it and clears the record.

### Leftovers (`usePlanTourLeftovers`)

`usePlanTourLeftovers`, composed in `useEditorState`, sweeps what the old tour left: once the document has hydrated,
a leftover record for this document has its element (and sheet, through `releaseSheets`) removed with no history.
When `releaseSheets` returns false (no Sheet has drawn to take it), the element and the record stay, `[plan-tour]
content.failed` is logged once, and the sweep tries again after `LEFTOVER_SHEET_RETRY_MS` (2000, a cheap check; the
sheet goes soon after the first Sheet draws). Once the items are ready, its items go too (`writeQuiet` deletes,
`[plan-tour] content.swept`); the record is cleared only once both the element and the items are swept. A record for
another document is kept. The example card writes the record while it exists, so a reload mid-tour sweeps it.

## Interfaces and contracts

- `UserPreferences.planTourTracks?: PlanTourTrack[]` (`'boards' | 'sheets' | 'dashboards'`; PlanTourHost runs the
  first two, `BoardSheetTrack`); missing = none answered. `planTourSeen?: boolean` counts every
  track only while `powerUserMode` is on. No migration (free-form preferences blob).
- `PLAN_TOUR_RELAUNCH_EVENT = 'livedoc:plan-tour-relaunch'`, dispatched by `requestPlanTourRelaunch()`.
- Leftover record: `localStorage['livedoc:v2:plan-tour-content']` = JSON `PlanTourContent`; a
  malformed value is dropped, never thrown. A record from before the Sheets track (`boardId`) reads as its
  `elementId`.
- Settings switches: **Plan Tours** (`tourTracksSwitch`, key `planTourSeen`, label **Plan Tours**, the second toggle
  row in the Tours category; reads on while any of `PLAN_TOUR_TRACKS` is owed; off writes `planTourSeen: true` with
  every track answered, on removes `planTourTracks` and clears `planTourSeen`; events `PlanTourSeenOff` /
  `PlanTourSeenOn`), then one row per track nested beneath it (`tourTrackSwitch`, `parent: 'planTourSeen'`), keys
  `planTourSeen-boards`, `planTourSeen-sheets` and `planTourSeen-dashboards`, labels **Boards Tour**, **Sheets Tour**
  and **Dashboards Tour**. A track's row reads on while `!planTrackSeen(p, track)`; it writes `planTourSeen: false`
  and `planTourTracks` = the tracks seen in `p` (the single flag folded in) with its own track added (off) or removed
  (on). The rows only record: the button stays on offer however they read. Help articles `planTour` (Boards, Sheets) and `planDashboards` (Dashboards); events
  `{ on: 'BoardsTourSeenOff', off: 'BoardsTourSeenOn' }`, `{ on: 'SheetsTourSeenOff', off: 'SheetsTourSeenOn' }` and
  `{ on: 'DashboardsTourSeenOff', off: 'DashboardsTourSeenOn' }`. `SettingsDialog`'s close relaunches when a track is
  owed that was not owed at open; the host starts the tour then only if it is on offer.
- `POWER_USER_PRESET.planTourSeen = { planTourSeen: true }`.

## Data and persistence

- `planTourTracks` and `planTourSeen`: synced preferences, per person.
- The tour's only document data is the example card: one item, written and deleted with no history entry. The
  subject is held in component state for the run only.
- The leftover record in `localStorage` holds the example card while it exists, and is swept and cleared.

## Errors and edge cases

| Case                                                  | Handling                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| No board or Sheet on the tab (empty, Dashboard)       | Not on offer; the button names another tour or is not drawn                                       |
| Settings rerun with no board or Sheet                 | Nothing starts; nothing is placed                                                                 |
| A press while another tour is on screen               | Nothing happens                                                                                   |
| A board with no column, or the card's create refused  | `addTourCard` returns null and logs; Add Cards and Move Work Along find no target and are skipped |
| A board with one column                               | `moveTourCard` does nothing; Move Work Along rings the card where it is                           |
| The board or Sheet has not drawn when a step runs     | The step's target is awaited 3500 ms, then skipped                                                |
| The subject is deleted mid-tour                       | The tour ends as skipped                                                                          |
| The person switches tab or leaves Plan mid-tour       | The tour ends as skipped; the card panel is closed                                                |
| A Sheet's toolbar or cog not shown to this person     | Its step finds no target and is skipped                                                           |
| Locked tab                                            | Not on offer                                                                                      |
| A leftover record (a reload mid-tour, or an old tour) | Swept on the next visit to that document                                                          |

## Security and trust

The tour writes only its example card, as the person, through the item store's ordinary writes, so it crosses no
new trust boundary. A Participant and a Viewer never see the
button for it (`isReadOnly`).

## Performance and limits

- `PlanTourHost` loads in its own chunk, draws nothing until a press and subscribes to one module store; its
  steps module is a few strings. Its offer is republished only when its name or rank changes.
- Per render while mounted: two `filter`s over the open tab's elements (linear; a tab holds a handful of plan
  elements).
- `visiblePlanWork` runs at a press only: one `querySelector` and one `getBoundingClientRect` per board or Sheet
  on the tab.
- `firstCardOn` is one `querySelector`, run on the card panel step only.
- The example card costs one item create, at most one move and one delete per run.
- The engine's 150 ms re-measure runs only while a tour is on screen.

## Presentation and UX

As the Diagram tour ([Diagram tour](../../007-editor/editor-tour.md)). The actions group's button reads **Start Boards
Tour** or **Start Sheets Tour**. The cards' `ariaPrefix` is **Boards tour** or **Sheets tour**. The last card is a
step card in `TourPopover`, with **Help** linking the track's article (`BOARDS_TOUR_COPY` or `SHEETS_TOUR_COPY`)
and **Start** (`TOUR_FINISH`). The tour has no art.

## Accessibility

As every editor tour: the popover is a labelled dialog ("Plan tour step 2 of 7: Add cards"), buttons are
native, the ring is `aria-hidden`, reduced motion stills the glide. The actions group's Start Tour button keeps its full name as its
accessible name when it shows the glyph alone.

## Web Experience

No work at page load; the host is in the editor bundle and draws nothing until a press. No layout shift: every
surface is fixed-position over the canvas.

## Observability

- `[plan-tour] start { track }`, `[plan-tour] end { outcome, answered }` through `debugLog`;
  the sweep's `[plan-tour] content.swept { items }`.

## Testing

| Rule                                                                       | Test                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| On the button with a board or Sheet on the tab; never starts on its own    | `PlanTourHost.test.tsx`                                  |
| Not on offer on an empty tab or a Dashboard; a rerun there places nothing  | `PlanTourHost.test.tsx`                                  |
| Not on offer when read-only, locked, unhydrated, embedded                  | `PlanTourHost.test.tsx`                                  |
| Starts nothing while another tour is on screen                             | `PlanTourHost.test.tsx`                                  |
| Reruns from Settings in Plan only                                          | `PlanTourHost.test.tsx`                                  |
| The button names the first untaken track; the track runs on the subject    | `PlanTourHost.test.tsx`                                  |
| A board with no cards still gets the card steps, on the card the tour adds | `PlanTourHost.test.tsx`, `plan-tour-steps.test.ts`       |
| Runs to the end, taking its example card away, sending no content events   | `PlanTourHost.test.tsx`                                  |
| Ends as skipped on another tab or the subject deleted                      | `PlanTourHost.test.tsx`                                  |
| Steps and selectors on the subject; adds, moves and opens its own card     | `plan-tour-steps.test.ts`                                |
| Title Case step titles                                                     | `plan-tour-steps.test.ts`                                |
| Leftover record round trip, malformed value dropped                        | `plan-tour.test.ts`                                      |
| Sweep of a leftover record                                                 | `usePlanTourLeftovers.test.ts`                           |
| Engine: prepare, skip a missing target, heal, finish outcomes              | `useTourEngine.test.tsx`                                 |
| Stage: default and Plan card words, ring, labels                           | `TourStage.test.tsx`                                     |
| Start Tour button: label, order left of Search, retake, none on offer      | `TourOfferButton.test.tsx`, `ChromeControls.test.tsx`    |
| Active-tour store                                                          | `tour-active.test.ts`                                    |
| Settings row inverted, events                                              | `settings-catalogue.test.ts`                             |
| Telemetry tokens charted and explained                                     | `apps/telemetry` `metric-emitters.test.ts`, explanations |

## Constants and configuration

| Constant                | Value                            | Provenance                              | Safe range   |
| ----------------------- | -------------------------------- | --------------------------------------- | ------------ |
| `TARGET_WAIT_MS`        | 3500                             | The shared engine's target wait         | 1000 to 6000 |
| `PLAN_TOUR_CONTENT_KEY` | `'livedoc:v2:plan-tour-content'` | The editor's storage key scheme (sweep) | fixed        |

## Defaults ledger

D28 (how long the old tour waited for items before its card steps) in [DEFAULTS.md](DEFAULTS.md), retired with
the old tour's example cards.
