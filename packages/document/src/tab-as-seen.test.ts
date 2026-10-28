import { describe, expect, it } from 'vitest';
import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { DEFAULT_SCHEME_LIGHT, THEMES } from './themes';
import { themeHalf } from './theme-halves';
import {
  PAGE_PAPER_DARK,
  builtInThemeSource,
  labelsFollowCanvas,
  pageInAppearance,
  pagesInAppearance,
  tabAsSeen,
} from './tab-as-seen';
import type { Tab } from './index';
import type { Page } from './page';

// A tab as one appearance sees it (docs/specs/011-theme/light-and-dark.md), shared by exports and thumbnails.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('builtInThemeSource', () => {
  it('reads Default as its light half and a catalogue theme as written', () => {
    expect(builtInThemeSource('brand')).toBe(DEFAULT_SCHEME_LIGHT);
    expect(builtInThemeSource(THEMES[1]!.id)).toBe(THEMES[1]);
  });

  it('names nothing for no id or an unknown one', () => {
    expect(builtInThemeSource(undefined)).toBeUndefined();
    expect(builtInThemeSource('custom:gone')).toBeUndefined();
  });
});

describe('labelsFollowCanvas', () => {
  it('follows the canvas on every tab but a Pages one', () => {
    expect(labelsFollowCanvas({})).toBe(true);
    expect(labelsFollowCanvas({ opensIn: 'pages' })).toBe(false);
    expect(labelsFollowCanvas({ pages: [{ id: 'p', orientation: 'portrait' }] })).toBe(false);
  });
});

describe('tabAsSeen', () => {
  it('draws a Default tab stored in either half in the asked half', () => {
    const light = tab();
    const dark = tab({ backgroundColor: DARK_CANVAS_BACKGROUND_COLOR });
    expect(tabAsSeen(light, 'dark', DEFAULT_SCHEME_LIGHT).backgroundColor).toBe(
      DARK_CANVAS_BACKGROUND_COLOR,
    );
    expect(tabAsSeen(dark, 'light', DEFAULT_SCHEME_LIGHT).backgroundColor).toBe(
      DEFAULT_BACKGROUND_COLOR,
    );
  });

  it('draws a catalogue theme in its asked half', () => {
    const theme = THEMES.find((t) => t.id === 'forest')!;
    const seen = tabAsSeen(
      tab({ theme: theme.id, backgroundColor: theme.backgroundColor }),
      'dark',
      theme,
    );
    expect(seen.backgroundColor).not.toBe(theme.backgroundColor);
    expect(seen.backgroundColor).toBe(themeHalf(theme, 'dark').backgroundColor);
  });

  it('keeps a canvas colour someone picked', () => {
    const seen = tabAsSeen(tab({ backgroundColor: '#ffe4e6' }), 'dark', DEFAULT_SCHEME_LIGHT);
    expect(seen.backgroundColor).toBe('#ffe4e6');
  });

  it('keeps the stored backdrop when the theme cannot be read', () => {
    const seen = tabAsSeen(
      tab({ theme: 'custom:gone', backgroundColor: '#123456' }),
      'light',
      undefined,
    );
    expect(seen.backgroundColor).toBe('#123456');
  });

  it('draws an element stored by stock colour name in the ink of the asked canvas', () => {
    const stroke = tab({
      elements: [
        {
          id: 's',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          penColour: 'ink',
        },
      ],
    });
    const light = tabAsSeen(stroke, 'light', DEFAULT_SCHEME_LIGHT).elements[0]!;
    const dark = tabAsSeen(stroke, 'dark', DEFAULT_SCHEME_LIGHT).elements[0]!;
    expect((light as { strokeColor?: string }).strokeColor).not.toBe(
      (dark as { strokeColor?: string }).strokeColor,
    );
  });
});

describe('pageInAppearance', () => {
  const plain: Page = { id: 'p', orientation: 'portrait' };
  const filled: Page = { ...plain, background: { fill: { kind: 'solid', color: '#fde68a' } } };

  it('lays a plain page on the dark paper in dark chrome', () => {
    expect(pageInAppearance(plain, 'dark').background?.fill).toEqual({
      kind: 'solid',
      color: PAGE_PAPER_DARK,
    });
  });

  it('leaves a plain page in light chrome, and a page with its own fill in either', () => {
    expect(pageInAppearance(plain, 'light')).toBe(plain);
    expect(pageInAppearance(filled, 'dark')).toBe(filled);
  });

  it('lays every page of a tab, and leaves a tab with none', () => {
    const pages = tab({ pages: [plain, filled] });
    expect(pagesInAppearance(pages, 'dark').pages?.map((p) => p.background?.fill)).toEqual([
      { kind: 'solid', color: PAGE_PAPER_DARK },
      filled.background!.fill,
    ]);
    expect(pagesInAppearance(pages, 'light')).toBe(pages);
    const none = tab();
    expect(pagesInAppearance(none, 'dark')).toBe(none);
  });
});
