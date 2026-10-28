'use client';

import { Suspense, createElement, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import { loadEditorPage, loadedEditorPage } from '@/lib/editor-page-loader';
import { prefetchNewDocumentOpenWhenIdle } from '@/app/explorer/new-document/start-new-document';
import { debugLog } from '@/lib/debug-log';
import { isPendingSettled } from '@/lib/new-document/pending-documents';
import { closeInPlace, openInPlace, useInPlaceDocument } from './in-place-editor-store';
import { documentIdFromPath, isEditorPath } from '@/lib/legacy-editor-path';

// How often an editor kept for its create checks whether it may go (D198).
export const IN_PLACE_SETTLE_POLL_MS = 250;

const subscribeAddress = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
};
const browserPathname = () => window.location.pathname;
const noPathname = () => null;

// The editor in the Explorer's place (docs/specs/013-workspace/new-document-menu.md "Opening at once", blueprint "In
// the Explorer's place"): a document made from the New Document menu opens here, under /document/<id>, with no page
// load. While the address names it the editor shows and the Explorer is gone; once the address leaves it (Back, or
// the editor's own way to the Explorer) the Explorer is back, and the editor stays, hidden, only until its document
// is settled, so nothing done before the create landed is lost.
export function InPlaceEditor({ children }: { children: ReactNode }) {
  const openId = useInPlaceDocument();
  // The address as the browser has it: startNewDocument moves it before it opens, Back moves it on popstate. Next's
  // pathname re-renders this on the router's own moves (the editor's way back to the Explorer).
  usePathname();
  const pathname = useSyncExternalStore(subscribeAddress, browserPathname, noPathname);
  // The document the address names, when the Explorer's layout is showing a document's address.
  const addressed = isEditorPath(pathname ?? '') ? documentIdFromPath(pathname ?? '').id : null;
  const shown = openId !== null && addressed === openId;

  // Forward to a document this page opened in place, after it went: open it here again, as any document opens.
  useEffect(() => {
    if (addressed === null || addressed === openId) return;
    let live = true;
    void loadEditorPage().then(() => {
      if (live) openInPlace(addressed);
    });
    return () => {
      live = false;
    };
  }, [addressed, openId]);

  // What opening needs comes in while the Explorer is idle.
  useEffect(() => prefetchNewDocumentOpenWhenIdle(), []);

  useEffect(() => {
    if (openId === null || shown) return;
    if (isPendingSettled(openId)) {
      closeInPlace(openId);
      return;
    }
    debugLog('[new-document] back-while-pending');
    const timer = window.setInterval(() => {
      if (isPendingSettled(openId)) closeInPlace(openId);
    }, IN_PLACE_SETTLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [openId, shown]);

  // The editor's component, loaded once and kept (editor-page-loader.ts): the same component every render.
  const editor = openId !== null ? loadedEditorPage() : null;
  return (
    <>
      {shown ? null : children}
      {editor ? (
        <div style={{ display: shown ? 'contents' : 'none' }}>
          <Suspense fallback={<OpeningScreen />}>
            {createElement(editor, { key: openId })}
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
