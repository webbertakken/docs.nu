// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): the starts the welcome offers and where
// each leads, picked from the templates package's catalogue. Its own module, read only by the lazily loaded welcome,
// so the catalogue never weighs on any other Home.

import {
  BLANK_TEMPLATE_FOR_OPENING,
  POPULAR_TEMPLATE_KINDS,
  isBlankTemplate,
  templateCreateHref,
  type TemplateKind,
} from '@livedoc/templates';
import { TAB_OPENINGS } from '@livedoc/document';

/** How many Popular templates the welcome shows. */
export const WELCOME_TEMPLATES_MAX = 4;

/** Start Blank: each opening's blank, in order (Sketch, Structured, Pages, Workshop, Plan). */
export const WELCOME_BLANKS: readonly TemplateKind[] = TAB_OPENINGS.map(
  (mode) => BLANK_TEMPLATE_FOR_OPENING[mode],
);

/** Popular Templates: the shared Popular list without its blanks, cut to WELCOME_TEMPLATES_MAX. */
export const WELCOME_POPULAR: readonly TemplateKind[] = POPULAR_TEMPLATE_KINDS.filter(
  (kind) => !isBlankTemplate(kind),
).slice(0, WELCOME_TEMPLATES_MAX);

/** Making one start at once. */
export const welcomeStartHref = (kind: TemplateKind): string => templateCreateHref(kind);
