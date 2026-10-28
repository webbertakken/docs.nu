// The N of a blank's "All N templates" (docs/specs/013-workspace/new-document-menu.md "The menu", blueprint D192): the
// cards its picker group shows on a new, empty document. Read from the starts' own groups, so the number is what the
// picker then shows.
import { isBlankTemplate, type NewDocumentBlank } from '@livedoc/templates';
import { TEMPLATE_STARTS, type TemplateStartMode } from '@/components/start/start-template-items';
import {
  itemsIn,
  startItems,
  type StartCategory,
} from '@/components/plan/start/start-planning-items';

const isTemplateStartMode = (mode: string): mode is TemplateStartMode => mode in TEMPLATE_STARTS;

export function pickerGroupCount(blank: NewDocumentBlank): number {
  const { mode, group } = blank.picker;
  if (mode === 'plan') {
    // A new document has no cards, so Card Table is not offered.
    return itemsIn(startItems({ hasCards: false }), group as StartCategory).length;
  }
  if (!isTemplateStartMode(mode)) return 0;
  const groups = TEMPLATE_STARTS[mode].groups;
  // Recommended stands for the whole start: every template it lists, each once, blanks aside.
  const kinds =
    group === 'recommended'
      ? new Set(groups.flatMap((g) => g.kinds))
      : new Set(groups.find((g) => g.id === group)?.kinds ?? []);
  return [...kinds].filter((k) => !isBlankTemplate(k)).length;
}
