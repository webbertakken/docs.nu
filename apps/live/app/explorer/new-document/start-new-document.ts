// The one way the New Document menu makes a document (docs/specs/013-workspace/new-document-menu.md "What each choice
// does", "Opening at once"; blueprint "Instant open"). A blank opens with its start closed, a template on the template.
// The document is made in the browser and opened in the Explorer's place at once; its create runs behind it
// (pending-documents.ts).
import {
  isBlankTemplate,
  untitledNameForTemplate,
  type NewDocumentBlankId,
  type TemplateKind,
} from '@livedoc/templates';
import { apiLoadSelf } from '@/lib/api-client';
import { assignAppLocation, interceptAppNavigation } from '@/lib/app-location';
import { signInOfferedHere } from '@/lib/auth-config';
import { debugLog } from '@/lib/debug-log';
import { loadEditorPage } from '@/lib/editor-page-loader';
import { prefetchWhenIdle } from '@/lib/idle-prefetch';
import { markNameConfirmed } from '@/lib/local-identity';
import { createIdsFor } from '@/lib/new-document/create-failure';
import {
  newDocumentCreator,
  type NewDocumentCreator,
} from '@/lib/new-document/new-document-creator';
import { addPendingDocument, type NewDocumentPlace } from '@/lib/new-document/pending-documents';
import { trackNewDocumentCreated, writeNewDocument } from '@/lib/new-document/write-new-document';
import { NEW_DOCUMENT_THEME_ID, newDocumentContent } from '@/lib/new-document-content';
import { handTemplatePick } from '@/lib/placement-defaults/template-pick-handoff';
import {
  defaultSaveLocationFor,
  isOfflineLocation,
  type SaveLocationId,
} from '@/lib/save-locations';
import { closeStartForBlank } from '@/components/start/close-start-for-blank';
import { openInPlace } from '@/app/explorer/in-place-editor/in-place-editor-store';

export type NewDocumentChoice = 'blank' | 'template';

export type NewDocumentRequest = {
  choice: NewDocumentChoice;
  blank: NewDocumentBlankId;
  // The blank's own for 'blank', the card's for 'template'.
  template: TemplateKind;
  // The section's place; absent is no choice, where a default folder may answer.
  place: NewDocumentPlace;
};

// The /new address for the same request: the way when the document cannot open here, and a workspace frame's own.
export function newDocumentHref(request: NewDocumentRequest): string {
  const params = new URLSearchParams();
  params.set('template', request.template);
  if (request.place.folderId) params.set('folder', request.place.folderId);
  if (request.place.teamId) params.set('team', request.place.teamId);
  return `/new?${params.toString()}`;
}

// Where a new document is stored: LiveDoc when placed, else the default for who is creating
// (docs/specs/006-document/save-locations.md "The default depends on who is creating").
function locationFor(place: NewDocumentPlace, creator: NewDocumentCreator): SaveLocationId {
  if (place.folderId || place.teamId) return 'livedoc';
  return defaultSaveLocationFor({
    signedIn: creator.signedIn,
    signInOffered: signInOfferedHere() === true,
  });
}

// The code a new document opens with: the editor's, and a Plan template's example cards.
const OPEN_CODE = [loadEditorPage, () => import('@livedoc/templates/plan-template-seeds')] as const;

// Fetches what opening needs ahead of the click: on idle, and on pointer enter or focus of the button.
export function prefetchNewDocumentOpen(): void {
  for (const load of OPEN_CODE) void load().catch(() => {});
}
export function prefetchNewDocumentOpenWhenIdle(): () => void {
  return prefetchWhenIdle(OPEN_CODE);
}

let starting = false;

export function startNewDocument(request: NewDocumentRequest): void {
  const { choice, blank, template } = request;
  debugLog(`[new-document] choice=${choice} blank=${blank} template=${template}`);
  if (starting) {
    debugLog('[new-document] busy');
    return;
  }
  // A workspace frame makes it its own way, in the frame (useWorkspaceNavigation).
  if (interceptAppNavigation(newDocumentHref(request), false)) return;
  const creator = newDocumentCreator();
  if (!creator) {
    debugLog('[new-document] no-creator');
    assignAppLocation(newDocumentHref(request));
    return;
  }
  starting = true;
  const startedAt = performance.now();
  openNewDocument(request, creator, startedAt)
    .catch((err: unknown) => {
      // Nothing was opened or registered: the /new path makes it instead.
      console.error('[new-document] open failed', err);
      assignAppLocation(newDocumentHref(request));
    })
    .finally(() => {
      starting = false;
    });
}

async function openNewDocument(
  request: NewDocumentRequest,
  creator: NewDocumentCreator,
  startedAt: number,
): Promise<void> {
  const { choice, template, place } = request;
  const ids = createIdsFor(null);
  const { documentId, tabId } = ids;
  if (choice === 'blank') closeStartForBlank(tabId, template);
  const location = locationFor(place, creator);
  const offline = isOfflineLocation(location);
  // A mode's blank in the cloud: a template picked on its start may move it to that template's default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  handTemplatePick(
    !offline && isBlankTemplate(template)
      ? { documentId, tabId, placementChosen: !!(place.folderId || place.teamId) }
      : null,
  );
  // Whoever is making a document has their name; the join prompt is for someone arriving at another's.
  markNameConfirmed();
  const name = untitledNameForTemplate(template);
  const content = await newDocumentContent({
    templateKind: template,
    themeId: NEW_DOCUMENT_THEME_ID,
    tabId,
    via: 'explorer',
  });
  await loadEditorPage();
  // A LiveDoc create needs only its owner's id; This Browser's example cards are signed by the person, if known.
  const author = async () =>
    offline
      ? ((await apiLoadSelf(creator.ownerId).catch(() => null)) ?? {
          id: 'pending',
          name: '',
          color: '',
        })
      : { id: creator.ownerId, name: '', color: '' };
  addPendingDocument(
    {
      id: documentId,
      name,
      tabs: content.tabs ?? [content.tab],
      itemTypes: content.itemTypes,
      ownerId: creator.ownerId,
      location,
      teamId: place.teamId ?? null,
      startedAt,
    },
    async (at) => {
      await writeNewDocument({
        ids,
        name,
        templateKind: template,
        content,
        location,
        creator: author,
        teamId: at.teamId,
        folderId: at.folderId,
      });
      trackNewDocumentCreated({ location, templateKind: template, teamId: at.teamId });
    },
    place,
  );
  // A new entry, so Back returns to the Explorer where it was.
  window.history.pushState(null, '', `/document/${documentId}`);
  openInPlace(documentId);
}
