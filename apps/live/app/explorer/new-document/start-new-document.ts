// The one way the New Document menu makes a document (docs/specs/013-workspace/new-document-menu.md "What each choice
// does", blueprint "Interfaces and contracts"). A blank opens with its start closed, a template on the template, and
// All templates on its mode's start at the picker group handed over (start-group.ts).
import type { NewDocumentBlankId } from '@livedoc/templates';
import type { TemplateKind } from '@livedoc/templates';
import { assignAppLocation } from '@/lib/app-location';
import { debugLog } from '@/lib/debug-log';
import { templateCreateHref } from '@livedoc/templates';

export type NewDocumentChoice = 'blank' | 'template' | 'all-templates';

export type NewDocumentRequest = {
  choice: NewDocumentChoice;
  blank: NewDocumentBlankId;
  // The blank's own for 'blank', the card's for 'template', the picker mode's blank for 'all-templates'.
  template: TemplateKind;
  // The section's place; absent is no choice, where a default folder may answer.
  place: { folderId?: string; teamId?: string };
};

export function startNewDocument(request: NewDocumentRequest): void {
  const { choice, blank, template, place } = request;
  debugLog(`[new-document] choice=${choice} blank=${blank} template=${template}`);
  const params = new URLSearchParams();
  if (place.folderId) params.set('folder', place.folderId);
  if (place.teamId) params.set('team', place.teamId);
  const href = templateCreateHref(template);
  const qs = params.toString();
  assignAppLocation(qs ? `${href}&${qs}` : href);
}
