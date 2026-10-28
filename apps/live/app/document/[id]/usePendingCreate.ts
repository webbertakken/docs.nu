import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';
import type { CreateFailure } from '@/lib/new-document/create-failure';
import {
  attachPendingEditor,
  forgetPendingDocument,
  pendingDocument,
  retryPendingDocument,
  subscribePendingDocuments,
  type PendingDocument,
} from '@/lib/new-document/pending-documents';
import { isOfflineLocation } from '@/lib/save-locations';

export type PendingCreateView = {
  // Saves wait: the document is still being made (docs/specs/013-workspace/blueprints/new-document-menu.md "Saves
  // held until the create lands").
  held: boolean;
  // Set while the create has failed: the not-saved banner's copy and action.
  failure: CreateFailure | null;
  retry: () => void;
  saveToMyDocuments: () => void;
};

const noPending = () => null;

// Whether the document is LiveDoc's and its reader not known yet: a save would go out as nobody.
function stillHeld(doc: PendingDocument, selfId: string): boolean {
  if (doc.create.status !== 'landed') return true;
  return !isOfflineLocation(doc.location) && selfId === 'self';
}

// The editor's view of a document it opened from memory (pending-documents.ts): its saves are held until the create
// lands; then a LiveDoc document becomes server-stored (the room connects) and the autosave, released, saves what was
// done meanwhile once. A document the editor fetched is never pending and never held.
export function usePendingCreate(opts: {
  documentId: string | null;
  selfId: string;
  setDocumentServerStored: (stored: boolean) => void;
  setDocumentTeamId: (teamId: string | null) => void;
  refreshDocumentList: (ownerId: string) => void;
}): PendingCreateView {
  const { documentId, selfId } = opts;
  const doc = useSyncExternalStore(
    subscribePendingDocuments,
    () => pendingDocument(documentId),
    noPending,
  );
  const held = doc !== null && stillHeld(doc, selfId);

  // The landing, once per document: what the create made it.
  const landedFor = useRef<string | null>(null);
  const land = useEffectEvent((landed: PendingDocument) => {
    landedFor.current = landed.id;
    const cloud = !isOfflineLocation(landed.location);
    debugLog(`[new-document] released saves=${cloud ? 'livedoc' : 'browser'}`);
    if (cloud) opts.setDocumentServerStored(true);
    opts.setDocumentTeamId(landed.teamId);
    opts.refreshDocumentList(selfId);
  });
  useEffect(() => {
    if (doc && !held && landedFor.current !== doc.id) land(doc);
  }, [doc, held]);

  // Forgotten when the editor goes: by then it has landed, or the page warned before leaving it.
  useEffect(() => {
    if (!documentId) return;
    return () => {
      if (pendingDocument(documentId)?.create.status === 'landed')
        forgetPendingDocument(documentId);
    };
  }, [documentId]);

  return {
    held,
    failure: doc?.create.status === 'failed' ? doc.create.failure : null,
    retry: () => {
      if (documentId) retryPendingDocument(documentId, { withoutPlacement: false });
    },
    saveToMyDocuments: () => {
      if (documentId) retryPendingDocument(documentId, { withoutPlacement: true });
    },
  };
}

// The open editor tells the registry whether it holds unsaved changes, for Back (isPendingSettled).
export function useAttachPendingEditor(
  documentId: string | null,
  hasUnsavedChanges: () => boolean,
): void {
  const latest = useLatest(hasUnsavedChanges);
  useEffect(() => {
    if (!documentId) return;
    return attachPendingEditor(documentId, () => latest.current());
  }, [documentId, latest]);
}
