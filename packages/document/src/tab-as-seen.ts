// A tab as a person in one appearance sees it (docs/specs/011-theme/light-and-dark.md): its backdrop in their half of
// its theme, every theme colour mapped to the same slot in that half, every stock colour stored by name in its version
// for the canvas, and a label that redraw sank into what is behind it in an ink that reads there. Pure: the editor's
// exports (apps/live/lib/export-as-seen.ts) and the server's Explorer thumbnails (docs/specs/006-document/
// document-snapshots.md) draw a tab through it, each resolving the theme with what it knows (the editor its custom
// themes, the api worker the document owner's).
import { canvasSurface, type CanvasSurface } from './colors';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR } from './canvas-colors';
import { hasPageLook, opensInOf } from './editor-mode';
import { layOutPages, pagesOf, type Page } from './page';
import { elementPageSurfaces } from './page-content';
import { resolveStockColours } from './stock-colours';
import { themeColourMap, viewBackdropInTheme, viewElementInTheme } from './theme-halves';
import {
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  THEMES,
  type Appearance,
  type ThemeDefinition,
} from './themes';
import { withReadableLabelInks } from './label-backdrop';
import type { BackgroundPattern, Element, Tab } from './index';

/** The surface of each element on a page with its own fill (elementPageSurfaces), and the theme map
 *  for each surface (themeColourMap in that appearance). */
export type PageView = {
  surfaces: ReadonlyMap<string, CanvasSurface>;
  maps: Readonly<Record<CanvasSurface, ReadonlyMap<string, string>>>;
};

/** The backdrop a tab paints for one appearance: only its two colours follow the half, the rest is layout. */
export type ResolvedBackdrop = {
  backgroundColor: string;
  patternColor: string;
  backgroundPattern: BackgroundPattern | undefined;
  backgroundOpacity: number | undefined;
};

// A plain page's paper in dark chrome, as the canvas paints it (CanvasPages' dark:bg-slate-900).
export const PAGE_PAPER_DARK = '#0f172a';

/** The page as a viewer in `appearance` sees it: a plain page in dark chrome takes the dark paper; a page with a
 *  fill of its own keeps it. */
export function pageInAppearance<P extends Pick<Page, 'background'>>(
  page: P,
  appearance: Appearance,
): P {
  if (appearance !== 'dark' || page.background?.fill) return page;
  return {
    ...page,
    background: { ...page.background, fill: { kind: 'solid', color: PAGE_PAPER_DARK } },
  };
}

/** The tab with every page as a viewer in `appearance` sees it (pageInAppearance), so what is drawn on a plain page
 *  in dark chrome is inked for the dark paper. A tab with no pages is itself. */
export function pagesInAppearance(tab: Tab, appearance: Appearance): Tab {
  if (!Array.isArray(tab.pages) || tab.pages.length === 0 || appearance !== 'dark') return tab;
  return { ...tab, pages: tab.pages.map((p) => pageInAppearance(p, appearance)) };
}

/** A built-in scheme as written (its native half, before tuning), or undefined for an id that names none. */
export function builtInThemeSource(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** Whether a tab's labels sit on its canvas and panels: not a Pages tab's, whose pages have their own paper. */
export function labelsFollowCanvas(
  tab: Pick<Tab, 'opensIn' | 'kind' | 'layers' | 'pages'>,
): boolean {
  return opensInOf(tab) !== 'pages' && !(Array.isArray(tab.pages) && tab.pages.length > 0);
}

/** The tab's backdrop in `appearance`: a canvas or pattern colour its scheme (`source`) painted, in either half,
 *  becomes that half's; a picked colour stays. No scheme to read leaves the backdrop as stored. */
export function tabBackdropInAppearance(
  tab: Pick<Tab, 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'>,
  source: ThemeDefinition | undefined,
  appearance: Appearance,
): ResolvedBackdrop {
  const stored = {
    backgroundColor: tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    patternColor: tab.patternColor ?? DEFAULT_PATTERN_COLOR,
    backgroundPattern: tab.backgroundPattern,
    backgroundOpacity: tab.backgroundOpacity,
  };
  if (!source) return stored;
  return { ...stored, ...viewBackdropInTheme(stored, source, appearance) };
}

/** One element as drawn: on its page's surface where it has one, else on the canvas's. */
export function elementAsSeen(
  el: Element,
  surface: CanvasSurface,
  themeMap: ReadonlyMap<string, string>,
  pageView?: PageView,
): Element {
  const onPage = pageView?.surfaces.get(el.id);
  return onPage
    ? resolveStockColours(viewElementInTheme(el, pageView!.maps[onPage]), onPage)
    : resolveStockColours(viewElementInTheme(el, themeMap), surface);
}

/** The tab as seen in `appearance`. `source` is its scheme as written (`tab.theme`, or Default when it has none),
 *  undefined when nobody here can resolve it (a custom theme not at hand): its backdrop then stays as stored and its
 *  elements read through Default's map. */
export function tabAsSeen(
  tab: Tab,
  appearance: Appearance,
  source: ThemeDefinition | undefined,
): Tab {
  const backdrop = tabBackdropInAppearance(tab, source, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this half, then the stock colours; an element on a page with a fill of its own in the half that
  // page's surface needs, as the canvas draws it.
  const scheme = source ?? DEFAULT_SCHEME_LIGHT;
  const themeMap = themeColourMap(scheme, appearance);
  const surfaces = hasPageLook(opensInOf(tab))
    ? elementPageSurfaces(tab.elements, layOutPages(pagesOf(tab)))
    : null;
  const pageView: PageView | undefined = surfaces?.size
    ? {
        surfaces,
        maps: { light: themeColourMap(scheme, 'light'), dark: themeColourMap(scheme, 'dark') },
      }
    : undefined;
  const drawn = tab.elements.map((el) => elementAsSeen(el, surface, themeMap, pageView));
  // As the canvas draws them: a label the half sank into what is behind it in an ink that reads there.
  const elements = labelsFollowCanvas(tab)
    ? [
        ...withReadableLabelInks(
          tab.elements,
          tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
          drawn,
          backdrop.backgroundColor,
        ),
      ]
    : drawn;
  return { ...tab, ...backdrop, elements };
}
