# Brand media

Derived from [Brand mark](../brand-mark.md). Every file the mark becomes, where it lives, how big it is and what
writes it. One module draws the mark; one script writes the static files; a test fails when a committed file drifts.

## The geometry module

`packages/ui/src/brand-mark-geometry.ts` holds the Page Stack:

| Name                 | Value                                                                   | Why                                                        |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `SHEET_SIZE`         | 140 × 150 plane units, folded corner 44                                 | One size for all three sheets; the page alone is dog-eared |
| `STACK_STEP`         | 40 along the plane, 12 extra rise                                       | Each sheet sits one step behind and above the next         |
| `ISO_PLANE`          | `matrix(cos 30°, 0.5, 0, 1, x, y)`                                      | The cube's left face plane, so the stack keeps its angle   |
| `BRAND_SHEETS`       | `sheet` (step 2), `plain` (step 1), `page` (step 0), back to front      | Draw order                                                 |
| `BRAND_MARK_VIEWBOX` | `-53 -70 296 296`                                                       | A square around the closed stack, 4% margin                |
| `BRAND_FAN`          | open adds one step between neighbours, centred on the plain sheet       | The hover fan spreads the stack without drifting it        |
| Gradients            | page `frontLeft`, plain `backSheet`, sheet `backRight`, fold `backTop`  | Brightest in front, deepest at the back                    |
| Mono opacities       | page 0.9, plain 0.65, sheet 0.45                                        | The stack reads in one colour                              |
| Compact lines        | two, 19 units wide                                                      | Whole pixels at 28px                                       |
| Full lines           | a 12-unit heading and three 7-unit lines; three grid cells on the sheet | Detail from 48px                                           |
| Full sheen           | white, 0.45 to 0.05, along the page's left, top, right and bottom edges | Glass                                                      |

`brandMarkSvg({ variant, scheme, tone, idPrefix })` writes the standalone SVG: `scheme` `light` or `dark` writes
literal colours, `auto` a `prefers-color-scheme` stylesheet (favicons); `tone: 'mono'` writes one colour
(`currentColor`, or `#ffffff` / `#000000` for the press files) with the lines cut out through a mask.
`brandLogoSvg(scheme)` writes the lockup: the full mark, a 24-unit gap, then `Live` in the accent and `Doc` in ink at
128 units, weight 600, in the system UI stack.

`<BrandMark>` (React, `packages/ui/src/Brand.tsx`) renders the same sheets from the same constants, with the theme
accent's palette, and `useBrandFan` (`packages/ui/src/useBrandFan.ts`) writes each sheet's offset on a frame loop
while it moves: open over `BRAND_FAN_OPEN_MS` (700), close over `BRAND_FAN_CLOSE_MS` (450), both easing out cubic,
nothing under `prefers-reduced-motion`.

## The files

`pnpm icons:brand` (`apps/live/scripts/brand-icons/render.mjs`) writes every static file below from the module, with
Playwright for the rasters. `apps/marketing/lib/brand-icon.test.ts` fails when a committed SVG differs from the module
or a raster is missing or the wrong size.

### Web

| File                                                                  | Size              | Drawing        | Background  |
| --------------------------------------------------------------------- | ----------------- | -------------- | ----------- |
| `apps/{marketing,live,help,telemetry}/app/icon.svg`                   | scalable          | compact, auto  | transparent |
| `apps/help/app/icon.png`                                              | 256               | full, light    | white       |
| `apps/marketing/public/favicon.ico`                                   | 16, 32, 48 inside | compact, light | transparent |
| `apps/marketing/public/livedoc-icon-256.png` (`BRAND_ICONS` fallback) | 256               | full, light    | white       |

### Android (web app manifest, `apps/marketing/app/manifest.ts`)

| File                                               | Size | Purpose      | Drawing                  | Background        |
| -------------------------------------------------- | ---- | ------------ | ------------------------ | ----------------- |
| `apps/marketing/public/livedoc-icon-192.png`       | 192  | `any`        | full, light, 73% of tile | white             |
| `apps/marketing/public/livedoc-icon-512.png`       | 512  | `any`        | full, light, 73% of tile | white             |
| `apps/marketing/public/livedoc-maskable-192.png`   | 192  | `maskable`   | full, light, 56% of tile | white, full bleed |
| `apps/marketing/public/livedoc-maskable-512.png`   | 512  | `maskable`   | full, light, 56% of tile | white, full bleed |
| `apps/marketing/public/livedoc-monochrome-512.png` | 512  | `monochrome` | compact, mono white, 56% | transparent       |

56% keeps every corner of the stack inside the maskable safe zone, the centre circle of 80% of the tile's width.
The manifest also lists `/icon.svg` as `any`.

### iOS

| File                                                    | Size | Drawing                  | Background |
| ------------------------------------------------------- | ---- | ------------------------ | ---------- |
| `apps/marketing/app/apple-icon.tsx` (rendered at build) | 180  | full, light, 73% of tile | white      |

`apps/marketing/app/layout.tsx` sets `appleWebApp: { title: 'LiveDoc', capable: true, statusBarStyle: 'default' }`.

### Social (rendered at build from the module, no committed raster)

| File                                                           | Size       |
| -------------------------------------------------------------- | ---------- |
| `apps/marketing/app/opengraph-image.tsx`                       | 1200 × 630 |
| `apps/marketing/app/twitter-image.tsx`                         | 1200 × 630 |
| `apps/marketing/app/about/features/[slug]/opengraph-image.tsx` | 1200 × 630 |
| `apps/help/app/og/[...card]/route.tsx`                         | 1200 × 630 |

Each draws through `packages/ui/src/social-card.tsx` or the help card with `brandMarkSvg({ variant: 'full',
scheme: 'light' })`. The api's share preview falls back to the site's card (`BRAND_CARD_PATH`).

### Email

| File                                              | Size | Drawing     | Background  |
| ------------------------------------------------- | ---- | ----------- | ----------- |
| `apps/marketing/public/email/livedoc-mark-64.png` | 64   | full, light | transparent |

Shown at 28px in the header and 22px in the footer of every email (`apps/api/src/email/templates.ts`). The path is
permanent.

### Press (`marketing/media/`)

| File                                                        | Form                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| `logo/livedoc-mark-{light,dark}.svg`                        | full mark, literal colours               |
| `logo/livedoc-mark-mono-{black,white}.svg`                  | full mark, one colour, lines cut out     |
| `logo/livedoc-logo-{light,dark}.svg`                        | lockup                                   |
| `logo/livedoc-logo-{light,dark}.png`                        | lockup, 1200 wide, transparent           |
| `icons/livedoc-icon-transparent-{16,32,64,128,256,512}.png` | mark, transparent (Google Drive's sizes) |
| `icons/livedoc-icon-{256,512,1024}.png`                     | mark on a white tile                     |

## Testing

- `packages/ui/src/brand-mark-geometry.test.ts`: the sheets' order and gradients, the closed stack inside the viewBox,
  compact versus full detail, mono's mask, literal versus `auto` colours, the lockup's wordmark split.
- `packages/ui/src/brand-mark-motion.test.ts`: the fan's offsets at closed, half and open, centred on the plain
  sheet; the easing's ends.
- `packages/ui/src/Brand.test.tsx`: the React mark draws the same sheets, the accent tints it, mono applies the
  opacities, reduced motion never starts the fan.
- `apps/marketing/lib/brand-icon.test.ts`: every committed SVG equals the module's output; every raster exists at its
  size; the manifest lists every Android icon with its purpose; `favicon.ico` holds 16, 32 and 48.
