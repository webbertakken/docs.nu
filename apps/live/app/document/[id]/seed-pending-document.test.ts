import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedoc/document';
import type { PendingDocument } from '@/lib/new-document/pending-documents';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { seedPendingDocument } from './seed-pending-document';

const tabs = [
  { id: 't1', name: 'Board', elements: [{ id: 'e1' }] },
  { id: 't2', name: 'Sheet', elements: [] },
] as unknown as Tab[];

const doc = (over: Partial<PendingDocument> = {}): PendingDocument => ({
  id: 'd1',
  name: 'Untitled Kanban',
  tabs,
  itemTypes: null,
  ownerId: 'owner-1',
  location: 'livedoc',
  teamId: 'team-1',
  startedAt: 0,
  create: { status: 'creating' },
  ...over,
});

function deps() {
  return {
    resetTabs: vi.fn(),
    lastSavedTabsRef: { current: [] as Tab[] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set<string>() },
    setActiveId: vi.fn(),
    setDocumentName: vi.fn(),
    setDocumentItemTypes: vi.fn(),
    setDocumentOwnerId: vi.fn(),
    setDocumentTeamId: vi.fn(),
    setDocumentShareable: vi.fn(),
    setDocumentShareCode: vi.fn(),
    setLoadedExistingDocument: vi.fn(),
    setLoadedTabIds: vi.fn(),
  };
}

describe('seedPendingDocument', () => {
  it('opens every tab whole, loaded, with the created content as the save baseline', () => {
    const d = deps();
    seedPendingDocument(doc(), d);
    expect(d.resetTabs).toHaveBeenCalledWith(tabs);
    expect(d.lastSavedTabsRef.current).toBe(tabs);
    expect(d.lastSavedNameRef.current).toBe('Untitled Kanban');
    expect([...d.loadedTabIdsRef.current]).toEqual(['t1', 't2']);
    expect(d.setLoadedTabIds).toHaveBeenCalledWith(new Set(['t1', 't2']));
    expect(d.setActiveId).toHaveBeenCalledWith('t1');
    expect(d.setDocumentName).toHaveBeenCalledWith('Untitled Kanban');
    expect(d.setDocumentItemTypes).toHaveBeenCalledWith({ itemTypes: null, itemTypesRev: 0 });
  });

  it('makes a LiveDoc document its creator’s, filed in its team', () => {
    const d = deps();
    seedPendingDocument(doc(), d);
    expect(d.setDocumentOwnerId).toHaveBeenCalledWith('owner-1');
    expect(d.setDocumentTeamId).toHaveBeenCalledWith('team-1');
  });

  it('makes a This Browser document the local sentinel’s', () => {
    const d = deps();
    seedPendingDocument(doc({ location: 'browser', teamId: null }), d);
    expect(d.setDocumentOwnerId).toHaveBeenCalledWith(OFFLINE_OWNER_ID);
  });
});
