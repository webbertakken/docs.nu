// The worker's way into a document's room (docs/specs/006-document/blueprints/document-storage.md "Interfaces and
// contracts"): one typed client per document, the room's RPCs with the document id filled in. Every read or write
// of one document's content from outside its routes comes through here.
//
// Inside the room itself the same call is a plain method call (DocumentRoom's local namespace), so code the worker
// and the room share (a document read's outline) costs no hop there.

import type { Item } from '@livedoc/items';
import type { ContentSummary } from '../db/content-summary';
import type { Env } from '../types';
import type { DocumentCopy, DocumentOutline } from './document-content';
import type { CreateOutcome, DocumentSeed } from './document-create';
import { roomUnavailable, type RouteIdentity } from './document-route';
import type { DocumentRoomRpc } from './document-rpc';

export type DocumentRoomClient = {
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  create(seed: DocumentSeed): Promise<CreateOutcome>;
  outline(): Promise<DocumentOutline>;
  hasTab(tabId: string): Promise<boolean>;
  placesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  image(request: Request, identity: RouteIdentity): Promise<Response>;
  exportCopy(
    onlyTabId: string | null,
    redactAuthorsFor: string | null,
  ): Promise<DocumentCopy | null>;
  importCopy(copy: DocumentCopy): Promise<ContentSummary>;
  item(itemId: string): Promise<Item | null>;
  respondToForm(request: Request, identity: RouteIdentity): Promise<Response>;
};

export function documentRoom(
  env: Pick<Env, 'DOCUMENT_ROOM'>,
  documentId: string,
): DocumentRoomClient {
  const ns = env.DOCUMENT_ROOM;
  // The stub's RPC types wrap every answer for the wire; the shapes here are the class's own.
  const room = ns.get(ns.idFromName(documentId)) as unknown as DocumentRoomRpc;
  return {
    route: (request, identity) => room.route(documentId, request, identity),
    create: (seed) => room.create(documentId, seed),
    outline: () => room.outline(documentId),
    hasTab: (tabId) => room.hasTab(documentId, tabId),
    placesImage: (imageId, onlyTabId) => room.placesImage(documentId, imageId, onlyTabId),
    image: (request, identity) => room.image(documentId, request, identity),
    exportCopy: (onlyTabId, redact) => room.exportCopy(documentId, onlyTabId, redact),
    importCopy: (copy) => room.importCopy(documentId, copy),
    item: (itemId) => room.item(documentId, itemId),
    respondToForm: (request, identity) => room.respondToForm(documentId, request, identity),
  };
}

// A worker request answered by a room: the room's answer, or 503 `room_unavailable` when the call throws (D16).
export async function askRoom(request: Request, call: () => Promise<Response>): Promise<Response> {
  try {
    return await call();
  } catch (error) {
    return roomUnavailable(request, error);
  }
}
