// The page-wide thumbnail cache (docs/specs/006-document/document-snapshots.md): bounded, least recently
// used out first, and an evicted picture's blob URL is released.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THUMBNAIL_CACHE_HELD_MAX,
  THUMBNAIL_CACHE_MAX,
  holdThumbnail,
  loadThumbnail,
  peekThumbnail,
  resetThumbnailCache,
  thumbnailKey,
} from './thumbnail-cache';

vi.mock('@/lib/api-client', () => ({
  apiFetchDocumentThumbnailUrl: async (_owner: string, id: string) => ({
    url: `blob:${id}`,
    backgroundColor: null,
  }),
}));

const req = (documentId: string) => ({ ownerId: 'me', documentId, version: 1, shareCode: null });

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  resetThumbnailCache();
  // The reset releases the previous case's pictures; each case counts only its own.
  vi.mocked(URL.revokeObjectURL).mockClear();
});

describe('thumbnail cache', () => {
  it('evicts the least recently used picture and releases its blob URL', async () => {
    for (let i = 0; i < THUMBNAIL_CACHE_MAX; i++) await loadThumbnail(req(`d${i}`));
    // Touch the oldest, so the second-oldest is now the one to go.
    await loadThumbnail(req('d0'));
    await loadThumbnail(req('overflow'));
    expect(peekThumbnail(thumbnailKey(req('d0')))).toBeDefined();
    expect(peekThumbnail(thumbnailKey(req('d1')))).toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:d1');
  });

  it('never evicts a picture a mounted thumbnail holds, growing past the bound instead', async () => {
    const releases: (() => void)[] = [];
    for (let i = 0; i < THUMBNAIL_CACHE_MAX + 5; i++) {
      releases.push(holdThumbnail(thumbnailKey(req(`d${i}`))));
      await loadThumbnail(req(`d${i}`));
    }
    expect(peekThumbnail(thumbnailKey(req('d0')))).toBeDefined();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    // Unmounted, the oldest go again, down to the bound.
    for (const release of releases.splice(0, 10)) release();
    await loadThumbnail(req('another'));
    expect(peekThumbnail(thumbnailKey(req('d0')))).toBeUndefined();
    expect(peekThumbnail(thumbnailKey(req('d10')))).toBeDefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:d0');
  });

  it('counts two holders of one picture until both let go', async () => {
    const key = thumbnailKey(req('shared'));
    const first = holdThumbnail(key);
    const second = holdThumbnail(key);
    await loadThumbnail(req('shared'));
    first();
    for (let i = 0; i < THUMBNAIL_CACHE_MAX; i++) await loadThumbnail(req(`d${i}`));
    expect(peekThumbnail(key)).toBeDefined();
    second();
    await loadThumbnail(req('one-more'));
    expect(peekThumbnail(key)).toBeUndefined();
  });

  it('stops growing at its hard bound, held or not', async () => {
    for (let i = 0; i < THUMBNAIL_CACHE_HELD_MAX + 1; i++) {
      holdThumbnail(thumbnailKey(req(`d${i}`)));
      await loadThumbnail(req(`d${i}`));
    }
    expect(peekThumbnail(thumbnailKey(req('d0')))).toBeUndefined();
    expect(peekThumbnail(thumbnailKey(req(`d${THUMBNAIL_CACHE_HELD_MAX}`)))).toBeDefined();
  });
});
