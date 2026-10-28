'use client';

// The New Document menu's pane (docs/specs/013-workspace/new-document-menu.md "The menu"): for the selected blank, its
// blank card (what Enter makes), up to six of its templates three to a row, and All N templates. Every card is a menu
// item; `data-spot` places it on the grid the menu's arrow keys walk (new-document-keys.ts).
import type { NewDocumentBlank, TemplateKind } from '@livedoc/templates';
import { lucideChevronRight, lucideLayoutGrid } from '@livedoc/icons/lucide';
import { lucideGlyph } from '@livedoc/ui';
import { TemplatePicture } from '@/components/start/template-card';
import { templateOf } from '@/components/start/start-template-items';
import { TEMPLATES_PER_ROW } from './new-document-keys';
import type { NewDocumentChoice } from './start-new-document';

const GridIcon = lucideGlyph(lucideLayoutGrid, 14);
const ChevronIcon = lucideGlyph(lucideChevronRight, 12);

export const spotAttr = (row: number, col: number) => `pane:${row}:${col}`;

const CARD =
  'rounded-lg border bg-white text-left outline-none transition hover:border-brand-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-800/60 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400';

export function NewDocumentPane({
  blank,
  count,
  onChoose,
}: {
  blank: NewDocumentBlank;
  count: number;
  onChoose: (choice: NewDocumentChoice, template: TemplateKind) => void;
}) {
  const blankTitle = templateOf(blank.blank).title;
  const lastRow = 1 + Math.ceil(blank.templates.length / TEMPLATES_PER_ROW);
  return (
    <div className="flex h-full min-w-0 flex-col p-3">
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        data-spot={spotAttr(0, 0)}
        aria-keyshortcuts="Enter"
        onClick={() => onChoose('blank', blank.blank)}
        className={`${CARD} flex w-full items-center gap-3 border-brand-500 p-1.5 ring-1 ring-brand-500/40 dark:border-brand-500`}
      >
        <span className="block h-10 w-[4.5rem] shrink-0 overflow-hidden rounded">
          <TemplatePicture kind={blank.blank} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">
            {blankTitle}
          </span>
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
            {blank.line}
          </span>
        </span>
        <span
          aria-hidden
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] leading-none text-slate-500 dark:border-slate-600 dark:text-slate-400"
        >
          Enter
        </span>
      </button>
      <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        From a template
      </div>
      <div
        role="group"
        aria-label={`${blank.name} templates`}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {blank.templates.map((kind, i) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            tabIndex={-1}
            data-spot={spotAttr(1 + Math.floor(i / TEMPLATES_PER_ROW), i % TEMPLATES_PER_ROW)}
            onClick={() => onChoose('template', kind)}
            className={`${CARD} border-slate-200 p-1 dark:border-slate-700`}
          >
            <span className="block h-14 overflow-hidden rounded">
              <TemplatePicture kind={kind} />
            </span>
            <span className="block truncate px-1 pt-1 text-[11px] font-medium text-slate-700 dark:text-slate-200">
              {templateOf(kind).title}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        data-spot={spotAttr(lastRow, 0)}
        onClick={() => onChoose('all-templates', blank.blank)}
        className="mt-auto flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] font-medium text-brand-700 outline-none transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:bg-slate-800 dark:focus-visible:outline-brand-400"
      >
        <span className="flex items-center gap-1.5">
          <GridIcon aria-hidden />
          All {count} {blank.name} templates
        </span>
        <ChevronIcon aria-hidden />
      </button>
    </div>
  );
}
