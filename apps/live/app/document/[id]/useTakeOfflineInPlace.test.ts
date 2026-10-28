// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-document/offline-mode.md "Taking offline in place": Take Offline on the open document waits for the
// pending save, closes the room so the server delete never reaches this editor as a deletion, takes it offline and
// refreshes the Explorer, with no reload; a failure opens the room again and the document stays on the server.

const { convert, track, store, dismissal, handoff } = vi.hoisted(() => ({
  convert: { takeCloudOffline: vi.fn() },
  track: vi.fn(),
  store: { offlineListDocuments: vi.fn() },
  dismissal: { dismissLocalMove: vi.fn() },
  handoff: { readTemplatePick: vi.fn(), handTemplatePick: vi.fn() },
}));
vi.mock('@/lib/offline/offline-convert', async (orig) => ({
  ...(await orig<typeof import('@/lib/offline/offline-convert')>()),
  takeCloudOffline: convert.takeCloudOffline,
}));
vi.mock('@/lib/offline/offline-store', () => store);
vi.mock('@/lib/offline/local-move-dismissal', () => dismissal);
vi.mock('@/lib/placement-defaults/template-pick-handoff', () => handoff);
vi.mock('@/lib/telemetry', () => ({ track }));

import { SyncStillSavingError } from '@/lib/offline/offline-convert';
import { SYNC_SAVE_WAIT_MS } from './useSyncInPlace';
import { useTakeOfflineInPlace } from './useTakeOfflineInPlace';

function setup(over: { ownerId?: string; unsaved?: () => boolean } = {}) {
  const deps = {
    documentId: 'doc-1',
    ownerId: over.ownerId ?? 'guest-1',
    hasUnsavedChanges: over.unsaved ?? (() => false),
    setDocumentServerStored: vi.fn(),
    refreshDocumentList: vi.fn(),
  };
  const { result } = renderHook(() => useTakeOfflineInPlace(deps));
  return { takeOffline: result.current, deps };
}

beforeEach(() => {
  convert.takeCloudOffline.mockResolvedValue(undefined);
  store.offlineListDocuments.mockResolvedValue([{ id: 'doc-1' }, { id: 'doc-2' }]);
  handoff.readTemplatePick.mockReturnValue(null);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useTakeOfflineInPlace', () => {
  it('closes the room, takes the document offline and refreshes the Explorer, with no reload', async () => {
    const { takeOffline, deps } = setup();
    await takeOffline();
    expect(deps.setDocumentServerStored).toHaveBeenCalledWith(false);
    expect(deps.setDocumentServerStored.mock.invocationCallOrder[0]).toBeLessThan(
      convert.takeCloudOffline.mock.invocationCallOrder[0]!,
    );
    expect(convert.takeCloudOffline).toHaveBeenCalledWith('doc-1', 'guest-1', null);
    expect(dismissal.dismissLocalMove).toHaveBeenCalledWith('guest-1', 2);
    expect(deps.refreshDocumentList).toHaveBeenCalledWith('guest-1');
    expect(track).toHaveBeenCalledWith('Document', 'Moved', 'TakenOffline');
  });

  it('opens the room again and stays on the server when it fails', async () => {
    convert.takeCloudOffline.mockRejectedValueOnce(new Error('tab load incomplete'));
    const { takeOffline, deps } = setup();
    await expect(takeOffline()).rejects.toThrow('tab load incomplete');
    expect(deps.setDocumentServerStored.mock.calls).toEqual([[false], [true]]);
    expect(deps.refreshDocumentList).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('drops the template-pick note for this document: there is no server folder to go to', async () => {
    handoff.readTemplatePick.mockReturnValue({
      documentId: 'doc-1',
      tabId: 't',
      placementChosen: false,
    });
    const { takeOffline } = setup();
    await takeOffline();
    expect(handoff.handTemplatePick).toHaveBeenCalledWith(null);
  });

  it('refuses while a save will not land', async () => {
    vi.useFakeTimers();
    const { takeOffline, deps } = setup({ unsaved: () => true });
    const done = takeOffline();
    const failed = expect(done).rejects.toBeInstanceOf(SyncStillSavingError);
    await vi.advanceTimersByTimeAsync(SYNC_SAVE_WAIT_MS + 200);
    await failed;
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();
    expect(convert.takeCloudOffline).not.toHaveBeenCalled();
  });

  it('does nothing under the placeholder owner', async () => {
    const { takeOffline } = setup({ ownerId: 'self' });
    await takeOffline();
    expect(convert.takeCloudOffline).not.toHaveBeenCalled();
  });
});
