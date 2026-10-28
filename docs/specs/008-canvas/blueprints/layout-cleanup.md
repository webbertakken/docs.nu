# Layout cleanup: blueprint

Derived from [Layout cleanup](../layout-cleanup.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/live/lib/auto-layout-choices.ts`               | Each choice's command name, keywords, notice name, options and telemetry type             |
| `apps/live/lib/editor-commands.ts`                   | The command palette's tidier commands, none on a locked tab                               |
| `apps/live/lib/tab-cleanup.ts`                       | `cleanupElements`: the one transform every tidier runs; settles a layout                  |
| `apps/live/lib/tidy-engine.ts`                       | `loadTidyEngine`, `withTidyEngine`: the tidiers loaded on demand                          |
| `apps/live/lib/locked-element-ids.ts`                | `lockedElementIds`: the lock rule, light enough for callers that do not tidy              |
| `apps/live/lib/tidy-verdict.ts`                      | `assessCleanup`, `cleanupVerdict`, `verdictNotice`: whether a tidier runs, and its notice |
| `apps/live/hooks/canvas/useTabCanvas.ts`             | `autoAlignTab`, `autoLayoutTab`: judge, refuse with a notice, or commit one undoable step |
| `apps/live/lib/auto-align.ts`, `auto-align-lines.ts` | Auto-align: per-element sizes, positions by shared lines, even spacing, the overlap guard |
| `packages/document/src/auto-layout-tidy.ts`          | The tidy profile: direction, anchoring, clear placement, routing hand-off, mindmap fit    |
| `packages/document/src/auto-layout-tidy-graph.ts`    | Units, riders, dashed arrows: the graph of nodes the profile lays out                     |
| `packages/document/src/auto-layout-tidy-rank.ts`     | Drawn-order loop breaking, side steps, zero-length side edges in the layering             |
| `packages/document/src/auto-layout-tidy-flow.ts`     | One component's flow positions: blocks, label-sized gaps, lane centres                    |
| `packages/document/src/auto-layout-route.ts`         | Square arrow routes around the boxes                                                      |
| `packages/document/src/auto-layout-route-grid.ts`    | Bucket grid of the boxes a route must clear                                               |

## Domain and naming

| Term         | Identifier                                                                                         | Meaning                                               |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tidier       | `CleanupKind = 'align' \| AutoLayoutChoice`                                                        | Auto-align or one Auto Layout style                   |
| Verdict      | `CleanupVerdict` (`ok`, `unchanged`, `covers`, `leaves-container`, `rearranges-lanes`, `unsuited`) | Whether a tidier runs, and why not                    |
| Tidy profile | `tidyLayoutElements`                                                                               | The editor's Auto Layout, as opposed to graph input's |
| Unit / rider | `tidyGraph(...).units`, `moverOf`                                                                  | What moves as one block / with its node               |

"Cleanup" is the name of the transform (`cleanupElements`); "tidy up" is only a command-palette keyword.

## Behaviour and state

- **Offered** in the command palette when the tab is not locked and the session may mutate (`editor-commands.ts`:
  the layout-cleanup commands sit under `!ctx.tabLocked`, and `isReadOnly` drops every mutating command, so a
  Participant and a Viewer get none).
- **Press**: `autoLayoutTab(choice)` / `autoAlignTab()` in `useTabCanvas`. `editsBlocked` or an empty tab: no-op.
  Otherwise `withTidyEngine` runs the rest once the tidiers are loaded.
- **Refusal** (`useTabCanvas.refused`): `assessCleanup` on the live tab; a verdict other than `ok` calls
  `notify(verdictNotice(name, verdict))` (an info toast) and commits nothing. A tab with elements but no arrows is
  judged like any other: Auto Layout passes unwired elements through, so it is `unchanged` (D81).
- **Commit**: one `commit` of `cleanupElements(current, kind, layers)`, so undo returns to the layout before it.

## Interfaces and contracts

```ts
assessCleanup(elements, kind, layers?): CleanupVerdict; // 'unsuited' first for a mindmap that does not fit
cleanupVerdict(before, after, { lanes?: boolean }): CleanupVerdict; // lanes: false for Auto-align
verdictNotice(name, v): string | null; // the palette's notice; null for 'ok'
useTabCanvas({ notify?: (message: string) => void, ... }); // autoAlignTab(), autoLayoutTab(choice?)
loadTidyEngine(): Promise<TidyEngine>; // once; every later call resolves to the same engine
withTidyEngine(go: (engine: TidyEngine) => void): void; // now if loaded, once loaded otherwise
```

`ChoiceSpec.name` is the tidier's name in its refusal notice ("Smart", "Flowchart Down", ...); Auto-align's is
`Auto-align`.

## Data and persistence

Nothing new is stored. A press persists exactly as any `commit` does.

## Errors and edge cases

- Locked tab: the commands are not offered; a press through another path is a no-op (`editsBlocked`).
- Empty tab: no-op, nothing loaded.
- A press before the tidiers arrive: queued on the one load, run once it resolves.
- A tidier that would not help: refused with its notice, no commit, no telemetry.

## Security and trust

Presentation only. The room and the api decide what a session may write; a Participant who forced a tidier would
still have its element moves refused by `applyParticipantOp`.

## Performance and limits

- A press runs `cleanupElements` once over the tab, after judging it once. Measured in `tab-cleanup.perf.test.ts`
  (D83): budget `TIDY_PRESS_BUDGET_MS` per run at `TIDY_PRESS_WORST_CASE_NODES` wired nodes, widened by
  `cpuBudgetMs` on CI (whose coverage-instrumented runners measure Smart at about 100 ms, against 24 ms on an
  M-series Mac). Measured on an M-series Mac, best of three, with the tidy profile: the checkout template 0.2 to
  1.4 ms per tidier; 50 nodes Smart 7 ms; 100 nodes Smart 18 ms; 300 nodes (one pass, past
  `SETTLE_ELEMENT_LIMIT`) Smart about 40 ms, Tree 52 ms, Mindmap 5 ms, Auto-align 3.6 ms. Crossing reduction
  builds each node's neighbours once and buckets edges by rank pair, and counts each pair's crossings as
  inversions with a Fenwick tree rather than testing every pair of edges. Placement works out each rank's spacing
  once, not on every sweep, and the router tests a leg only against the boxes in the grid cells it passes
  (`auto-layout-route-grid.ts`, `ROUTE_GRID_CELL`).
- **First load:** the tidy profile, its router, the verdicts and `cleanupElements` load on demand
  (`lib/tidy-engine.ts`): a palette command loads them at the press. Auto-align's line logic (about 2.3 KiB) stays
  in the first load, since the AI apply path runs it there.

## Observability

- Press: the tidier's `Tab·Aligned[·type]` from `autoLayoutTab` / `autoAlignTab`.
- Refusal: the info notice names the tidier and the reason; nothing is sent.

## Testing

| Spec rule                                                                                                   | Test                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The tidiers are command-palette commands, none on a locked tab                                              | `editor-commands.test.ts`                                                               |
| Loaded on demand, a command before the load runs once it lands                                              | `tidy-engine.test.ts`                                                                   |
| Press budget at the worst case                                                                              | `tab-cleanup.perf.test.ts`                                                              |
| Palette refusal with a notice                                                                               | `useTabCanvas.test.ts`                                                                  |
| Every verdict and its copy                                                                                  | `tidy-verdict.test.ts`                                                                  |
| Checkout survives Auto-align, Smart, Down                                                                   | `tidy-verdict.test.ts`                                                                  |
| A second press finds a template tidy                                                                        | `tidy-verdict.test.ts`                                                                  |
| Auto-align keeps lines, spacing, no overlap                                                                 | `auto-align-lines.test.ts`, `auto-align.test.ts`                                        |
| Tidy profile: spine, side steps, square routes clear of boxes, title, settled, units, riders, dashed arrows | `packages/document/src/auto-layout-tidy.test.ts`                                        |
| The route grid misses no box a leg could hit; crossings match a pair-by-pair count                          | `packages/document/src/auto-layout-route-grid.test.ts`, `auto-layout-crossings.test.ts` |

## Constants and configuration

| Constant                             | Value   | Provenance                                                                                                           | Safe range      |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- | --------------- |
| `TIDY_PRESS_WORST_CASE_NODES`        | 300     | A dense hand-drawn diagram (D83)                                                                                     | —               |
| `TIDY_PRESS_BUDGET_MS`               | 100     | A press must feel immediate (D83); asserted as `cpuBudgetMs` of it, 300 on CI's coverage runners (`CI_CPU_HEADROOM`) | 50–200 (CI: 3x) |
| `ALIGN_TOLERANCE`                    | 8 px    | Hand drift under one grid step (D99)                                                                                 | 4–10            |
| `LINK_TOLERANCE`                     | 16 px   | An arrow's ends a little out of line (D99)                                                                           | 10–24           |
| `MAX_ALIGN_PASSES`                   | 4       | Two is usual (D100)                                                                                                  | 2–6             |
| `MAX_LAYOUT_PASSES`                  | 3       | A hand-drawn tree takes two (D100)                                                                                   | 1–4             |
| `SETTLE_ELEMENT_LIMIT`               | 300     | Three passes stay in the press budget below it (D100)                                                                | 150–500         |
| `IN_LINE_PX`                         | 12      | Drawn in line, not a layout's lean (D102)                                                                            | 8–20            |
| `TIDY_RANK_GAP` / `TIDY_SIBLING_GAP` | 56 / 48 | The checkout's own rows are 44 apart (D103)                                                                          | 40–90           |
| `TIDY_CLEARANCE`                     | 24      | Room between the block and a title (D103)                                                                            | 16–40           |
| `CLEARANCE` / `LOOP_OFFSET` (route)  | 10 / 32 | A leg's gap to a box; a loop's lane outside (D104)                                                                   | 6–16 / 24–48    |
| `ROUTE_GRID_CELL`                    | 160 px  | About one box and its gap: a leg spans a few cells                                                                   | 80–400          |
| `LANE_GAP` / `LANE_GAP_DRIFT`        | 48 / 16 | A swimlane's lanes are 36 apart; a layout's own spacing (D105)                                                       | 24–64 / 8–24    |

## Defaults ledger

D81, D83 and D99 to D105 in [DEFAULTS.md](DEFAULTS.md); D82, D84, D85, D86 and D101 are retired with the Tidy Up
popover.
