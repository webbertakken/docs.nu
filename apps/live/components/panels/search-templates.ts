import { POPULAR_TEMPLATE_KINDS, TEMPLATES } from '@livedoc/templates';
import type { TemplateSearchItem } from '@/lib/search';

// The templates the search panel offers to start from (docs/specs/007-editor/command-palette.md "One search"): every
// template the New Document wizard lists, the shared Popular list first so a tie goes to the one people pick most.
// Built once: the catalogue does not change while the app runs.
const popular = new Map(POPULAR_TEMPLATE_KINDS.map((kind, i) => [kind, i] as const));

export const SEARCH_TEMPLATES: readonly TemplateSearchItem[] = TEMPLATES.filter((t) => !t.hidden)
  .map(({ kind, title, description }, i) => ({
    kind,
    title,
    description,
    rank: popular.get(kind) ?? popular.size + i,
  }))
  .sort((a, b) => a.rank - b.rank)
  .map(({ kind, title, description }) => ({ kind, title, description }));
