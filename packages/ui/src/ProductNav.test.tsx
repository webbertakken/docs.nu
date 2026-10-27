import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductNav, ProductNavLinks } from './ProductNav';

// docs/specs/019-marketing/marketing-site.md "Header": on a phone the apps menu opens between the
// page's 16px gutters. Anchored to its trigger (~150px in), the w-60 card ran past a 360px screen's
// right edge, cut off when open and widening the page while hidden.
describe('ProductNav', () => {
  const html = renderToStaticMarkup(<ProductNav current="home" showOnMobile />);

  it('pins the menu to the page gutters below sm, straight under the trigger', () => {
    const bridge = html.match(/<div class="(absolute left-0 top-full[^"]*)"/)?.[1] ?? '';
    expect(bridge.split(' ')).toEqual(
      expect.arrayContaining(['max-sm:fixed', 'max-sm:inset-x-4', 'max-sm:top-auto']),
    );
  });

  it('lets the card fill that width on a phone and keeps w-60 from sm', () => {
    expect(html).toMatch(/class="w-60 max-sm:w-auto /);
  });
});

// docs/specs/004-interface-design/menus.md "Product switcher": the menu switches between the places someone works,
// the Editor and the Explorer; Home, Help and Telemetry are footer links. Its trigger still names the section shown.
describe('ProductNav entries', () => {
  const menuLabels = (html: string) =>
    [
      ...html.matchAll(
        /role="menuitem"[^>]*>.*?<span class="text-sm font-semibold[^"]*">([^<]+)<\/span>/g,
      ),
    ].map((m) => m[1]);

  it('offers only the Editor and the Explorer', () => {
    expect(menuLabels(renderToStaticMarkup(<ProductNav current="explorer" />))).toEqual([
      'Editor',
      'Explorer',
    ]);
  });

  it.each([
    ['home', 'Home'],
    ['help', 'Help'],
    ['telemetry', 'Telemetry'],
    ['explorer', 'Explorer'],
  ] as const)('names the %s section on its trigger', (current, label) => {
    const html = renderToStaticMarkup(<ProductNav current={current} />);
    expect(html).toContain(`aria-label="Switch section, currently ${label}"`);
    expect(menuLabels(html)).toEqual(['Editor', 'Explorer']);
  });
});

// docs/specs/013-workspace/explorer-structure.md "Layout": the editor's Explorer footer carries the same surfaces as
// links, the current one left out; Home, Help and Telemetry live here rather than in the menu.
describe('ProductNavLinks', () => {
  const html = renderToStaticMarkup(<ProductNavLinks current="editor" />);

  it('lists every other surface as a link, in order', () => {
    const labels = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>.*?<\/span>([^<]+)<\/a>/g)].map(
      (m) => m[2],
    );
    expect(labels).toEqual(['Home', 'Explorer', 'Help', 'Telemetry']);
    expect(html).toContain('aria-label="Go to"');
    expect(html).not.toContain('>Editor<');
  });

  it('is 44 px tall on a touch screen', () => {
    expect(html).toContain('pointer-coarse:h-11');
  });
});

describe('ProductNavLinks on the Explorer page', () => {
  it('lists the editor beside Home, Help and Telemetry', () => {
    const html = renderToStaticMarkup(<ProductNavLinks current="explorer" />);
    const labels = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>.*?<\/span>([^<]+)<\/a>/g)].map(
      (m) => m[2],
    );
    expect(labels).toEqual(['Home', 'Editor', 'Help', 'Telemetry']);
  });
});
