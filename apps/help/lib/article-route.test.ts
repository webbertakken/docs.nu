import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { articleCrumbs, parentRouteHref, routeHref } from './article-route';

describe('routeHref', () => {
  it('adds the trailing slash the help app serves', () => {
    expect(routeHref('/palette/tools/data-elements/legend')).toBe(
      '/palette/tools/data-elements/legend/',
    );
    expect(routeHref('/canvas/')).toBe('/canvas/');
    expect(routeHref('/')).toBe('/');
    expect(routeHref('')).toBe('/');
  });
});

describe('parentRouteHref', () => {
  it('is the route one level up, at any depth', () => {
    expect(parentRouteHref('/palette/tools/data-elements/legend')).toBe(
      '/palette/tools/data-elements/',
    );
    expect(parentRouteHref('/developers/working-with-documents/edit-operations/')).toBe(
      '/developers/working-with-documents/',
    );
    expect(parentRouteHref('/about/what-is-livedoc/')).toBe('/about/');
    expect(parentRouteHref('/canvas/')).toBe('/');
    expect(parentRouteHref('/')).toBe('/');
  });
});

// The breadcrumb's parent crumb links to the route one level up, so every
// article that names a parent must sit directly under a real page.
const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const withParent = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx'))
  .map((p) => p.slice(0, -'/page.mdx'.length))
  .filter((dir) => /parentArticle=\{/.test(readFileSync(`${APP_DIR}/${dir}/page.mdx`, 'utf8')));

describe('sub-article parents', () => {
  it('finds the sub-articles (guard against this test going blind)', () => {
    expect(withParent.length).toBeGreaterThan(50);
  });

  it('every sub-article sits directly under a real page', () => {
    const orphaned = withParent.filter((dir) => {
      const parent = parentRouteHref(`/${dir}`).replace(/^\/|\/$/g, '');
      return !(
        existsSync(`${APP_DIR}/${parent}/page.mdx`) || existsSync(`${APP_DIR}/${parent}/page.tsx`)
      );
    });
    expect(orphaned).toEqual([]);
  });
});

// docs/specs/018-help/help-pages.md "Article pages": the trail is read off the route.
describe('articleCrumbs', () => {
  it('links the top category to its own landing, apart from a nested article’s parent', () => {
    expect(
      articleCrumbs({
        pathname: '/developers/working-with-documents/edit-operations/',
        title: 'Edit Operations Reference',
        categoryTitle: 'Developers',
        parentTitle: 'Working with Documents',
      }),
    ).toEqual([
      { label: 'Developers', href: '/developers/' },
      { label: 'Working with Documents', href: '/developers/working-with-documents/' },
      { label: 'Edit Operations Reference' },
    ]);
  });

  it('names a mode’s page as the parent of its tour, never the category', () => {
    expect(
      articleCrumbs({
        pathname: '/canvas/draw-mode/draw-tour',
        title: 'The Draw Tour',
        categoryTitle: 'Canvas',
        parentTitle: 'Draw Mode',
      }),
    ).toEqual([
      { label: 'Canvas', href: '/canvas/' },
      { label: 'Draw Mode', href: '/canvas/draw-mode/' },
      { label: 'The Draw Tour' },
    ]);
  });

  it('is the category then the article for a top-level article', () => {
    expect(
      articleCrumbs({ pathname: '/canvas/themes/', title: 'Themes', categoryTitle: 'Canvas' }),
    ).toEqual([{ label: 'Canvas', href: '/canvas/' }, { label: 'Themes' }]);
  });

  it('leaves out a category that repeats the title or the parent', () => {
    expect(
      articleCrumbs({
        pathname: '/selection-modes/slide-deck/presenting/',
        title: 'Presenting',
        categoryTitle: 'Slide Deck',
        parentTitle: 'Slide Deck',
      }),
    ).toEqual([
      { label: 'Slide Deck', href: '/selection-modes/slide-deck/' },
      { label: 'Presenting' },
    ]);
    expect(
      articleCrumbs({ pathname: '/about/about/', title: 'About', categoryTitle: 'About' }),
    ).toEqual([{ label: 'About' }]);
  });

  it('never gives two crumbs one URL', () => {
    const crumbs = articleCrumbs({
      pathname: '/developers/workbenches/',
      title: 'Workbenches',
      categoryTitle: 'Developers',
      parentTitle: 'Developers',
    });
    const hrefs = crumbs.flatMap((c) => (c.href ? [c.href] : []));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
