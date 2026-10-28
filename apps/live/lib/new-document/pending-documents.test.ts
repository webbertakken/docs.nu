import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/core';
import {
  addPendingDocument,
  attachPendingEditor,
  forgetPendingDocument,
  isPendingSettled,
  pendingDocument,
  resetPendingDocumentsForTests,
  retryPendingDocument,
  subscribePendingDocuments,
  type PendingDocumentInput,
} from './pending-documents';
import { heldDocumentIn, resetCreateHoldsForTests, whenDocumentCreated } from './create-hold';

const ID = '0b6a3f4e-5d0c-4c1e-9a43-1f2e3d4c5b6a';

const input = (over: Partial<PendingDocumentInput> = {}): PendingDocumentInput => ({
  id: ID,
  name: 'Untitled Diagram',
  tabs: [],
  itemTypes: null,
  ownerId: 'owner-1',
  location: 'livedoc',
  teamId: null,
  startedAt: 0,
  ...over,
});

// A write the test settles by hand.
function controlledWrite() {
  const calls: { place: object; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const write = vi.fn(
    (place: object) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ place, resolve, reject });
      }),
  );
  return { write, calls };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  resetPendingDocumentsForTests();
  resetCreateHoldsForTests();
});

describe('pending documents', () => {
  it('registers a document as creating and starts its write at once', () => {
    const { write } = controlledWrite();
    addPendingDocument(input(), write, { folderId: 'f1' });
    expect(pendingDocument(ID)?.create).toEqual({ status: 'creating' });
    expect(write).toHaveBeenCalledWith({ folderId: 'f1' });
  });

  it('holds requests naming the document until the create lands', async () => {
    const { write, calls } = controlledWrite();
    addPendingDocument(input(), write, {});
    expect(heldDocumentIn(`/api/documents/${ID}/tabs/t1`)).toBe(ID);
    const held = whenDocumentCreated(ID);
    let released = false;
    void held!.then(() => (released = true));
    await flush();
    expect(released).toBe(false);
    calls[0]!.resolve();
    await flush();
    expect(released).toBe(true);
    expect(pendingDocument(ID)?.create).toEqual({ status: 'landed' });
    expect(whenDocumentCreated(ID)).toBeNull();
    expect(heldDocumentIn(`/api/documents/${ID}`)).toBeNull();
  });

  it('never holds the create itself or another document', () => {
    addPendingDocument(input(), controlledWrite().write, {});
    expect(heldDocumentIn('/api/documents')).toBeNull();
    expect(heldDocumentIn('/api/documents/another-id/tabs')).toBeNull();
    expect(whenDocumentCreated('another-id')).toBeNull();
  });

  it('keeps holding after a failure, with its copy, and releases on a retry that lands', async () => {
    const { write, calls } = controlledWrite();
    addPendingDocument(input(), write, { teamId: 'team-1' });
    let released = false;
    void whenDocumentCreated(ID)!.then(() => (released = true));
    calls[0]!.reject(new ApiError('create document', 403, 'team_forbidden'));
    await flush();
    const failed = pendingDocument(ID)!.create;
    expect(failed.status).toBe('failed');
    expect(failed.status === 'failed' && failed.failure.action).toBe('choose');
    expect(released).toBe(false);

    retryPendingDocument(ID, { withoutPlacement: true });
    expect(pendingDocument(ID)?.create).toEqual({ status: 'creating' });
    expect(calls[1]!.place).toEqual({});
    calls[1]!.resolve();
    await flush();
    expect(released).toBe(true);
  });

  it('retries with the same place unless told to drop it', async () => {
    const { write, calls } = controlledWrite();
    addPendingDocument(input(), write, { folderId: 'f1' });
    calls[0]!.reject(new Error('network'));
    await flush();
    retryPendingDocument(ID, { withoutPlacement: false });
    expect(calls[1]!.place).toEqual({ folderId: 'f1' });
  });

  it('ignores a retry while the create is still running or has landed', async () => {
    const { write, calls } = controlledWrite();
    addPendingDocument(input(), write, {});
    retryPendingDocument(ID, { withoutPlacement: false });
    expect(write).toHaveBeenCalledTimes(1);
    calls[0]!.resolve();
    await flush();
    retryPendingDocument(ID, { withoutPlacement: false });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('tells subscribers when the create changes', async () => {
    const { write, calls } = controlledWrite();
    const listener = vi.fn();
    const stop = subscribePendingDocuments(listener);
    addPendingDocument(input(), write, {});
    calls[0]!.resolve();
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it('is settled once landed and its editor holds nothing unsaved', async () => {
    const { write, calls } = controlledWrite();
    addPendingDocument(input(), write, {});
    let unsaved = true;
    attachPendingEditor(ID, () => unsaved);
    expect(isPendingSettled(ID)).toBe(false);
    calls[0]!.resolve();
    await flush();
    expect(isPendingSettled(ID)).toBe(false);
    unsaved = false;
    expect(isPendingSettled(ID)).toBe(true);
  });

  it('reads a forgotten or unknown document as settled', () => {
    addPendingDocument(input(), controlledWrite().write, {});
    forgetPendingDocument(ID);
    expect(pendingDocument(ID)).toBeNull();
    expect(isPendingSettled(ID)).toBe(true);
  });
});
