# Brand motion

Derived from [Brand mark](../brand-mark.md) "Size and motion". Units inside the mark are viewBox units (the
`BRAND_MARK_VIEWBOX` square is 295.4 wide); a step is one `STACK_STEP` along the stack, 34.64 right and 32 up.

## Structure

`<BrandMark>` draws each sheet as two groups:

- `[data-sheet-motion="<key>"]`, in screen space: the assembly and the press move it with CSS transforms.
- `[data-sheet="<key>"]` inside it, carrying the isometric `transform` attribute: the fan rewrites that attribute.

So the three motions never write the same property. The page's text lines carry `data-line`, the grid cells
`data-cell`, the fold `data-fold`; the whole drawing sits in `[data-mark-art]`, which the press scales.

## Assemble (`packages/ui/src/brand-motion.css`)

A content stylesheet, imported by every app's `globals.css`. It animates the logos that carry `data-assemble` (the
site header's and the editor header's `<Brand assemble>`), only while `<html>` lacks `data-brand-assembled`:

| Part                      | From                                   | Duration | Delay             | Easing                         |
| ------------------------- | -------------------------------------- | -------- | ----------------- | ------------------------------ |
| Each sheet, back to front | 48 units up, transparent until 35%     | 700ms    | 0, 110, 220ms     | `cubic-bezier(.34,1.36,.64,1)` |
| Grid cells (`full`)       | scale 0.3, transparent                 | 260ms    | 420ms + 60ms each | `cubic-bezier(.2,.8,.2,1)`     |
| Text lines                | scaleX 0 from the left                 | 380ms    | 560ms + 70ms each | `cubic-bezier(.2,.8,.2,1)`     |
| The fold                  | folded up (flipped about its diagonal) | 360ms    | 760ms             | `cubic-bezier(.4,0,.2,1)`      |
| `Live`, then `Doc`        | 14px left, transparent                 | 500ms    | 520ms, 610ms      | `cubic-bezier(.2,.8,.2,1)`     |

Every part fills `backwards`, so the static HTML paints the first frame. `BRAND_ASSEMBLE_MS` (1700) after hydration,
`useBrandAssembled` sets `data-brand-assembled` on `<html>`; a header mounted later (a client navigation) is drawn
whole. Under `prefers-reduced-motion: reduce` the logo instead fades in over 250ms.

## Fan (`packages/ui/src/useBrandFan.ts`)

As before: `fan` 0..1 over `BRAND_FAN_OPEN_MS` (700) and `BRAND_FAN_CLOSE_MS` (450), easing out cubic, written to
each `[data-sheet]` as `sheetTransform(step, fan)`; nothing under reduced motion.

## Press (`packages/ui/src/useBrandPress.ts`)

Web Animations on the logo's own elements, started by `pointerdown` (not touch-cancelled), or Enter or Space down,
ended by `pointerup`, `pointerleave`, `pointercancel`, `blur` or the key coming up:

| Element              | Pressed                   | In            | Out            |
| -------------------- | ------------------------- | ------------- | -------------- |
| `sheet` motion group | 0.15 step toward the page | 90ms ease-out | 160ms ease-out |
| `plain` motion group | 0.07 step toward the page | 90ms ease-out | 160ms ease-out |
| `[data-mark-art]`    | scale 0.97 about centre   | 90ms ease-out | 160ms ease-out |

No overshoot (the gallery's 09b). Reduced motion: the art's opacity dips to 0.85 and back, 100ms each way.

## Every kind (`apps/marketing/components/HeroKinds.tsx`, `apps/marketing/app/hero-kinds.css`)

`<BrandMark variant="full" pageContent={…}>` at 80px, with the four kinds' contents stacked on the page
(`BRAND_KINDS` in `packages/ui/src/brand-kinds.ts`: `page` the full drawing's lines; `sheet` a table, header row
filled; `board` three cards joined by two links; `form` two labelled fields and a button), and a caption of four
stacked names (`Page`, `Sheet`, `Board`, `Form`) beneath.

- One 6400ms cycle, infinite: each kind shows for a quarter, entering over 320ms (from 10 units below, transparent)
  and leaving over 320ms (to 10 units above); the caption's names crossfade with them. The page lifts 5 units and
  settles in the first quarter of each kind.
- An `IntersectionObserver` sets `data-paused` while the mark is off screen; paused, every animation's
  `animation-play-state` is `paused`.
- Reduced motion: a 9600ms cycle, opacity only, no lift.
- The caption is `aria-hidden`; the mark's group carries the accessible name "Pages, sheets, boards and forms".

## Testing

- `packages/ui/src/Brand.test.tsx`: the two groups per sheet; `assemble` marks the logo; the press moves the motion
  groups and the art, and only dims under reduced motion; touch never presses.
- `packages/ui/src/useBrandAssembled.test.ts`: sets the attribute after `BRAND_ASSEMBLE_MS`, once.
- `packages/ui/src/brand-motion.test.ts`: the stylesheet animates only `[data-assemble]` under
  `html:not([data-brand-assembled])`, fills backwards, and has a reduced-motion branch.
- `apps/marketing/components/HeroKinds.test.tsx`: four kinds and four names, the accessible name, paused off screen.
- The motion-budget guards register `brand-motion.css` and `hero-kinds.css` as content stylesheets.
