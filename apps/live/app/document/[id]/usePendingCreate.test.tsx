// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addPendingDocument,
  notePendingPainted,
  pendingDocument,
  resetPendingDocumentsForTests,
  type PendingDocumentInput,
} from '@/lib/new-document/pending-documents';
import { resetCreateHoldsForTests } from '@/lib/new-document/create-hold';
import { usePendingCreate } from './usePendingCreate';

const ID = 'd0c0ffee-0000-4000-8000-000000000001';

const input = (over: Partial<PendingDocumentInput> = {}): PendingDocumentInput => ({
  id: ID,
  name: 'Untitled Diagram',
  tabs: [],
  itemTypes: null,
  ownerId: 'owner-1',
  location: 'livedoc',
  teamId: 'team-1',
  startedAt: 0,
  ...over,
});

function controlledWrite() {
  const calls: { place: object; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const write = vi.fn(
    (place: object) =>
      new Promise<void>((resolve, reject) => calls.push({ place, resolve, reject })),
  );
  return { write, calls };
}

// Added and painted by its editor, as an open does: the write starts after the paint.
async function addPainted(...args: Parameters<typeof addPendingDocument>) {
  addPendingDocument(...args);
  notePendingPainted(args[0].id);
  await act(async () => {});
}

function render(selfId = 'owner-1', documentId: string | null = ID) {
  const deps = {
    setDocumentServerStored: vi.fn(),
    setDocumentTeamId: vi.fn(),
    refreshDocumentList: vi.fn(),
  };
  const hook = renderHook(
    ({ id, self }) => usePendingCreate({ documentId: id, selfId: self, ...deps }),
    {
      initialProps: { id: documentId, self: selfId },
    },
  );
  return { ...hook, deps };
}

afterEach(() => {
  resetPendingDocumentsForTests();
  resetCreateHoldsForTests();
});

describe('usePendingCreate', () => {
  it('never holds a document the editor fetched', async () => {
    const { result, deps } = render();
    expect(result.current.held).toBe(false);
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();
  });

  it('holds saves until the create lands, then makes a LiveDoc document server-stored once', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input(), write, { teamId: 'team-1' });
    const { result, deps, rerender } = render();
    expect(result.current.held).toBe(true);
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();

    await act(async () => calls[0]!.resolve());
    expect(result.current.held).toBe(false);
    expect(deps.setDocumentServerStored).toHaveBeenCalledExactlyOnceWith(true);
    expect(deps.setDocumentTeamId).toHaveBeenCalledWith('team-1');
    expect(deps.refreshDocumentList).toHaveBeenCalledWith('owner-1');
    rerender({ id: ID, self: 'owner-1' });
    expect(deps.setDocumentServerStored).toHaveBeenCalledTimes(1);
  });

  it('keeps a This Browser document off the server when it lands', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input({ location: 'browser', teamId: null }), write, {});
    const { result, deps } = render();
    await act(async () => calls[0]!.resolve());
    expect(result.current.held).toBe(false);
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();
  });

  it('holds a LiveDoc document while its reader is still the placeholder', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input(), write, {});
    const { result, rerender } = render('self');
    await act(async () => calls[0]!.resolve());
    expect(result.current.held).toBe(true);
    rerender({ id: ID, self: 'owner-1' });
    expect(result.current.held).toBe(false);
  });

  it('keeps holding through a failure, offers Try again, and lands on the same write', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input(), write, { teamId: 'team-1' });
    const { result, deps } = render();
    await act(async () => calls[0]!.reject(new Error('network')));
    expect(result.current.held).toBe(true);
    expect(result.current.failure?.action).toBe('retry');

    act(() => result.current.retry());
    expect(result.current.failure).toBeNull();
    expect(write).toHaveBeenCalledTimes(2);
    expect(calls[1]!.place).toEqual({ teamId: 'team-1' });
    await act(async () => calls[1]!.resolve());
    expect(result.current.held).toBe(false);
    expect(deps.setDocumentServerStored).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('saves to My Documents with no placement, no longer in the team', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input(), write, { teamId: 'team-1' });
    const { result, deps } = render();
    await act(async () => calls[0]!.reject(new Error('refused')));
    act(() => result.current.saveToMyDocuments());
    expect(calls[1]!.place).toEqual({});
    await act(async () => calls[1]!.resolve());
    expect(deps.setDocumentTeamId).toHaveBeenLastCalledWith(null);
  });

  it('forgets a landed document when the editor goes', async () => {
    const { write, calls } = controlledWrite();
    await addPainted(input(), write, {});
    const { unmount } = render();
    await act(async () => calls[0]!.resolve());
    unmount();
    expect(pendingDocument(ID)).toBeNull();
  });
});
