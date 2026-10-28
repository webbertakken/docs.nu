import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runInlineScript } from '@livedoc/vitest-config/inline-script';
import {
  APPEARANCE_BOOT_SCRIPT,
  APPEARANCE_STORAGE_KEY,
  DARK_MEDIA_QUERY,
} from './appearance-storage';
import { CHROME_SURFACES } from './chrome-colour';

// The pre-paint appearance script (docs/specs/004-interface-design/appearance.md). Every
// app's root layout inlines it, so a first-time visitor on a dark machine lands dark
// before first paint on whichever app they reach first.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const APPS = ['live', 'marketing', 'help', 'telemetry'] as const;
const layoutOf = (app: (typeof APPS)[number]) => read(`../../../../apps/${app}/app/layout.tsx`);

describe('the inlined storage key', () => {
  it('survives being quoted inside the script', () => {
    // It is interpolated into `localStorage.getItem('<key>')`: an apostrophe ends
    // the string early, a backslash or newline mangles it.
    for (const value of [APPEARANCE_STORAGE_KEY, DARK_MEDIA_QUERY]) {
      expect(value).not.toMatch(/['"\\\n\r]/);
      expect(APPEARANCE_BOOT_SCRIPT).toContain(`'${value}'`);
    }
  });

  it('comes from a module with no client boundary', () => {
    // A `'use client'` module hands a server layout a stub, not the string. That
    // is the bug this module's separation exists to prevent.
    expect(read('./appearance-storage.ts')).not.toMatch(/^\s*['"]use client['"]/m);
  });
});

describe.each(APPS)('the %s root layout', (app) => {
  const layout = layoutOf(app);

  it('inlines the appearance script', () => {
    expect(layout).toMatch(
      /dangerouslySetInnerHTML=\{\{ __html: trustedHtml\(APPEARANCE_BOOT_SCRIPT\) \}\}/,
    );
  });

  it('stays a server component, so the script runs before hydration', () => {
    expect(layout).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('lets the pre-paint class differ from the static HTML', () => {
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });

  it('paints a dark body under the dark class', () => {
    expect(layout).toMatch(/<body[^>]*className="[^"]*dark:bg-slate-950/);
  });
});

// Run the script the way the browser does, as source against stub globals: what
// matters is which stored values end up dark, not the script's text.
function runAppearanceBoot(opts: {
  stored?: string | null;
  osPrefersDark?: boolean;
  matchMedia?: boolean;
  throwOnRead?: boolean;
  meta?: boolean;
  ground?: boolean;
}): { classes: string[]; themeColor: string | undefined; added: number } {
  const classes: string[] = [];
  const existing = opts.meta ? { name: 'theme-color', content: '#0ea5e9' } : null;
  let meta: { name?: string; content?: string } | null = existing;
  let added = 0;
  const stubs = {
    localStorage: {
      getItem: (): string | null => {
        if (opts.throwOnRead) throw new Error('denied');
        return opts.stored ?? null;
      },
    },
    matchMedia:
      opts.matchMedia === false
        ? undefined
        : (query: string) => ({ matches: !!opts.osPrefersDark && query.includes('dark') }),
    document: {
      documentElement: {
        classList: { add: (c: string) => classes.push(c) },
        getAttribute: (name: string) =>
          name === 'data-chrome-surface' && opts.ground ? 'ground' : null,
      },
      querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
      createElement: (tag: string) => (tag === 'meta' ? {} : null),
      head: {
        appendChild: (el: { name?: string; content?: string }) => {
          added++;
          meta = el;
        },
      },
    },
  };
  runInlineScript(APPEARANCE_BOOT_SCRIPT, stubs);
  return { classes, themeColor: meta?.name === 'theme-color' ? meta.content : undefined, added };
}

describe('the appearance boot script', () => {
  it('paints dark for a stored Dark', () => {
    expect(runAppearanceBoot({ stored: 'dark' }).classes).toEqual(['dark']);
  });

  it('leaves a stored Light alone, even on a dark-themed OS', () => {
    expect(runAppearanceBoot({ stored: 'light', osPrefersDark: true }).classes).toEqual([]);
  });

  it('follows the device when nothing is stored, which is the default', () => {
    expect(runAppearanceBoot({ stored: null, osPrefersDark: true }).classes).toEqual(['dark']);
    expect(runAppearanceBoot({ stored: null, osPrefersDark: false }).classes).toEqual([]);
  });

  it('falls back to the device for a value it does not recognise', () => {
    expect(runAppearanceBoot({ stored: 'Dark', osPrefersDark: true }).classes).toEqual(['dark']);
  });

  it('follows the OS for a stored System', () => {
    expect(runAppearanceBoot({ stored: 'system', osPrefersDark: true }).classes).toEqual(['dark']);
    expect(runAppearanceBoot({ stored: 'system', osPrefersDark: false }).classes).toEqual([]);
  });

  it('survives a browser with no matchMedia', () => {
    expect(runAppearanceBoot({ stored: 'system', matchMedia: false }).classes).toEqual([]);
  });

  it('tints the browser chrome before first paint, light or dark', () => {
    expect(runAppearanceBoot({ stored: 'light' })).toMatchObject({
      themeColor: CHROME_SURFACES.header.light,
      added: 1,
    });
    expect(runAppearanceBoot({ stored: 'dark' }).themeColor).toBe(CHROME_SURFACES.header.dark);
  });

  it('tints it the page ground where the layout declares one', () => {
    expect(runAppearanceBoot({ stored: 'light', ground: true }).themeColor).toBe(
      CHROME_SURFACES.ground.light,
    );
    expect(runAppearanceBoot({ stored: 'dark', ground: true }).themeColor).toBe(
      CHROME_SURFACES.ground.dark,
    );
  });

  it('reuses a theme-color meta already in the head', () => {
    expect(runAppearanceBoot({ stored: 'dark', meta: true })).toMatchObject({
      themeColor: CHROME_SURFACES.header.dark,
      added: 0,
    });
  });

  it('survives localStorage being unavailable', () => {
    expect(() => runAppearanceBoot({ throwOnRead: true })).not.toThrow();
  });
});
