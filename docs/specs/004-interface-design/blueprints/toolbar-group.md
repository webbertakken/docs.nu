# Toolbar group blueprint

Derived from [Toolbar group](../toolbar-group.md). Where the groups sit and what they hold is the editor's
[two lines blueprint](../../007-editor/blueprints/two-lines.md).

## Domain and naming

| Term (spec)       | Identifier                                                         | File                                             |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| toolbar group     | `ToolbarGroup`                                                     | `apps/live/components/chrome/ToolbarGroup.tsx`   |
| its surface       | `TOOLBAR_CARD` (unchanged)                                         | `apps/live/components/chrome/toolbar-surface.ts` |
| divider           | `ToolbarDivider`                                                   | `apps/live/components/chrome/ToolbarGroup.tsx`   |
| a group's button  | `TOOLBAR_BUTTON`, `TOOLBAR_ICON_BUTTON`, `TOOLBAR_CONTROL_PRESSED` | `apps/live/components/chrome/toolbar-surface.ts` |
| a part of a group | `ToolbarPart` (a run of buttons a divider parts from the next)     | `apps/live/components/chrome/ToolbarGroup.tsx`   |

## Behaviour and state

- `ToolbarGroup` renders a `div` with `TOOLBAR_CARD` and `items-center` (every child centred on the cross axis); it
  takes `className`, `style`, `ref` and the data attributes its caller needs (`data-toolbar-menu`,
  `data-zoom-cluster`, `data-whiteboard-dock`'s scroller), so the strip, the dock and every line group render through
  it without changing what they measure.
- `ToolbarPart` renders its children in a `flex items-center gap-0.5` run. Inside a group, every part after the first
  that renders draws a `ToolbarDivider` before it, by CSS: `[[data-toolbar-part]~&]:before` draws the 1 px rule, so
  a part that renders nothing (`null`, or an empty run, `empty:hidden`) leaves no doubled or dangling divider.
- `ToolbarDivider` is the 1 px, 24 px tall rule with 2 px either side (`mx-0.5 h-6 w-px shrink-0 bg-slate-200
dark:bg-slate-700`, `aria-hidden`); the strip's `Divider` uses its class and Sketch's dock draws `ToolbarDivider` itself (the strip's keeps its
  `STRIP_DIVIDER_ATTR` and its phone hairline margins).
- `TOOLBAR_BUTTON`: `flex h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium
text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800
dark:hover:text-white touch-target-y`; `TOOLBAR_ICON_BUTTON` the same 36 px square (`w-9 px-0`);
  `TOOLBAR_CONTROL_PRESSED` the palette's pressed tint (`bg-brand-50 text-brand-700 dark:bg-brand-500/15
dark:text-brand-200`).

## Interfaces and contracts

- `ToolbarGroup`: `ComponentProps<'div'>` plus `label?: string` (sets `role="toolbar"` and `aria-label` when given).
- `ToolbarPart`: `{ children: ReactNode; className?: string }`.
- No group nests a bordered box: a caller's pressed or current control takes `TOOLBAR_CONTROL_PRESSED` or its own
  tint, never a border of its own (the active tab's ring is an inset `box-shadow`).

## Errors and edge cases

- A group whose parts all render nothing is not drawn by its caller (it checks what it has, the group never hides
  itself, so nothing measures a box that vanishes on its own).

## Presentation and UX

- 46 px tall: 36 px buttons, 4 px padding, 1 px border. A 28 px badge, a 19 px pill and a 13 px label each sit on the
  centre line (`items-center`, labels `text-optical-centre`).

## Accessibility

- A labelled group is a `toolbar`; the line groups are labelled ("Document", "Tools", "Actions", "Brand"); the strip and
  the dock keep their own roles.
- Buttons keep their focus ring (`focus-visible:ring-2 ring-brand-400`) and 44 px touch targets.

## Testing

| Rule                                          | Test                                                |
| --------------------------------------------- | --------------------------------------------------- |
| The surface, height and centring              | `apps/live/components/chrome/ToolbarGroup.test.tsx` |
| A divider between rendered parts only         | `apps/live/components/chrome/ToolbarGroup.test.tsx` |
| The strip and the dock draw through the group | `ToolbarPalette` and `WhiteboardDock` tests         |

## Constants and configuration

The classes in `toolbar-surface.ts` above; no numbers outside them.

## Defaults ledger

Rows in [DEFAULTS.md](DEFAULTS.md) under "toolbar-group".
