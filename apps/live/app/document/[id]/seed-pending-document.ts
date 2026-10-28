import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@livedoc/document';
import type { SavedItemTypes } from '@/lib/api/item-types';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { PendingDocument } from '@/lib/new-document/pending-documents';
import { isOfflineLocation } from '@/lib/save-locations';
import type { ShareRole } from '@/lib/api-client';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, hasConfirmedName } from '@/lib/local-identity';
import { setLoadStep } from '@/lib/load-progress';
import { noteDocumentLoadEnded, startEditorTiming } from '@/lib/timing';
import { debugLog } from '@/lib/debug-log';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Seeds the editor from a pending document (docs/specs/013-workspace/blueprints/new-document-menu.md "The editor's
// bootstrap branch"): its tabs are whole and in memory, so every one is loaded and none is fetched, and the autosave's
// baseline is the content the create writes, so what is done before the create lands is saved once it has. The
// counterpart of seed-fetched-document.ts, for a document that has nothing on the server to fetch yet.
export function seedPendingDocument(
  doc: PendingDocument,
  deps: {
    resetTabs: Dispatch<SetStateAction<Tab[]>>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
    setActiveId: SetState<string>;
    setDocumentName: SetState<string>;
    setDocumentItemTypes: SetState<SavedItemTypes>;
    setDocumentOwnerId: SetState<string | null>;
    setDocumentTeamId: SetState<string | null>;
    setDocumentShareable: SetState<boolean>;
    setDocumentShareCode: SetState<string | null>;
    setLoadedExistingDocument: SetState<boolean>;
    setLoadedTabIds: SetState<Set<string>>;
  },
): void {
  const ids = new Set(doc.tabs.map((t) => t.id));
  deps.resetTabs(doc.tabs);
  deps.lastSavedTabsRef.current = doc.tabs;
  deps.lastSavedNameRef.current = doc.name;
  for (const id of ids) deps.loadedTabIdsRef.current.add(id);
  deps.setLoadedTabIds(new Set(ids));
  if (doc.tabs[0]) deps.setActiveId(doc.tabs[0].id);
  deps.setDocumentName(doc.name);
  deps.setDocumentItemTypes({ itemTypes: doc.itemTypes, itemTypesRev: 0 });
  // A This Browser document is the local sentinel's; a LiveDoc one its creator's.
  deps.setDocumentOwnerId(isOfflineLocation(doc.location) ? OFFLINE_OWNER_ID : doc.ownerId);
  deps.setDocumentTeamId(doc.teamId);
  deps.setDocumentShareable(false);
  deps.setDocumentShareCode(null);
  deps.setLoadedExistingDocument(true);
}

// Opens a pending document in the editor (the bootstrap's branch for it): no participant fetch, no document or tab
// fetch, no share-link list. The reader is the creator the Explorer already knew; their profile settles in the
// background as an early open's does. Timed as NewDocumentOpen from the click, logged `[new-document] opened ms=`.
export function openPendingDocument(
  doc: PendingDocument,
  deps: Parameters<typeof seedPendingDocument>[1] & {
    selfParticipant: Participant;
    setSelfParticipant: SetState<Participant>;
    setDocumentServerStored: SetState<boolean>;
    setIsOwner: SetState<boolean>;
    setSessionRole: SetState<ShareRole>;
    setDocumentId: SetState<string | null>;
    setNameConfirmed: SetState<boolean>;
    setHydrated: SetState<boolean>;
    setLoadingDocument: SetState<boolean>;
  },
): void {
  const timing = startEditorTiming('NewDocumentOpen', { from: doc.startedAt });
  deps.setSelfParticipant({
    ...deps.selfParticipant,
    id: doc.ownerId,
    key: ensureCollabKey(),
    status: 'online',
  });
  seedPendingDocument(doc, deps);
  // Not server-stored until the create lands (usePendingCreate): no room, no presence.
  deps.setDocumentServerStored(false);
  deps.setIsOwner(true);
  deps.setSessionRole('edit');
  deps.setDocumentId(doc.id);
  deps.setNameConfirmed(hasConfirmedName());
  deps.setHydrated(true);
  deps.setLoadingDocument(false);
  setLoadStep('done');
  noteDocumentLoadEnded();
  timing.endAfterPaint((ms) => debugLog(`[new-document] opened ms=${Math.round(ms)}`));
}
