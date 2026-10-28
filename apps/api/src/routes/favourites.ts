// /api/favourites — per-user document stars (docs/specs/013-workspace/favourites.md).
//
// GET    /api/favourites            -> { ids: string[] }
// PUT    /api/favourites/:documentId -> 204, star it
// DELETE /api/favourites/:documentId -> 204, un-star it
//
// Hybrid identity like the rest of the api: the account id when signed
// in, X-Owner-Id otherwise, so guests get durable favourites too.
//
// A star needs the document within the starrer's reach (reachesDocument: their own personal document, a joined
// member of its team, or a live link they opened). Any other id answers 404 exactly as a missing one and writes
// nothing, so a star never tells a stranger that an id is real.

import { reachesDocument } from '../auth/document-reach';
import { json, missingAuth, noContent, notFound } from '../responses';
import { addFavourite, getDocumentMeta, listFavouriteIds, removeFavourite } from '../db';
import type { RouteContext } from './context';

export async function handleFavourites(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'favourites') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    return json({ ids: await listFavouriteIds(env, ownerId) });
  }

  const documentId = segments[2];
  if (segments.length === 3 && documentId) {
    if (request.method === 'PUT') {
      const liveDoc = await getDocumentMeta(env, documentId);
      const reacher = { owner: ownerId, accountId: ctx.verifiedAccountId };
      if (!liveDoc || !(await reachesDocument(env, reacher, liveDoc))) {
        console.info('[favourites] star_refused reason=out_of_reach');
        return notFound();
      }
      if (!(await addFavourite(env, ownerId, documentId))) return notFound();
      return noContent();
    }
    if (request.method === 'DELETE') {
      await removeFavourite(env, ownerId, documentId);
      return noContent();
    }
  }
  return notFound();
}
