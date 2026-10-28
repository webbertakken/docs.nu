'use client';

import { useEffect, type RefObject } from 'react';
import { useAppearance } from '@livedoc/ui';
import { loadThumbnail, type ThumbnailRequest } from '@/lib/thumbnail-cache';

// Asks for a document's snapshot as its row nears the viewport, so the Details view's preview
// paints at once from the page's snapshot cache (docs/specs/013-workspace/explorer-details-view.md
// "Preloaded"). The thumbnails' own rule: 200px ahead, once per row, cancelled on unmount. Null
// asks for nothing (an empty document, one in this browser, no viewer yet). In the viewer's half, as the
// thumbnails ask for it, so the two share one cache entry.
export function useSnapshotPrefetch(
  ref: RefObject<Element | null>,
  request: Omit<ThumbnailRequest, 'appearance'> | null,
): void {
  const { appearance } = useAppearance();
  const ownerId = request?.ownerId;
  const documentId = request?.documentId;
  const version = request?.version;
  const shareCode = request?.shareCode ?? null;
  useEffect(() => {
    const el = ref.current;
    if (!el || ownerId === undefined || documentId === undefined || version === undefined) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        // A failed fetch settles as `broken` in the cache; the preview then shows the undrawn sketch.
        loadThumbnail({ ownerId, documentId, version, shareCode, appearance }).catch(() => {});
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, ownerId, documentId, version, shareCode, appearance]);
}
