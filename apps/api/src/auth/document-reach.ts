// Whether a person reaches a document at all, for the doors that answer about one without opening it: an assignee's
// access hint, the assigner's own check, a star (docs/specs/013-workspace/favourites.md). Three legs: their own
// personal document, a joined member of its team's library, or a live share link they opened.
//
// A team document is the team's (docs/specs/013-workspace/team-shared-documents.md): making one grants nothing on its
// own, so its maker reaches it as a member and loses it with the rest of the team's once they leave. The team leg
// reads the VERIFIED account id only, never the unsigned X-Owner-Id header (auth/document-access.ts says why).
import { getMembership, hasSharedAccess } from '../db';
import type { Env } from '../types';
import { isPersonalOwner } from './share-access';

export type DocumentReacher = {
  // The hybrid identity: an account id, or a guest's X-Owner-Id.
  owner: string;
  // The verified account id; null for a guest.
  accountId: string | null;
};

export async function reachesDocument(
  env: Env,
  reacher: DocumentReacher,
  liveDoc: { id: string; ownerId: string; teamId: string | null },
): Promise<boolean> {
  if (isPersonalOwner(reacher.owner, liveDoc.ownerId, liveDoc.teamId)) return true;
  if (
    liveDoc.teamId &&
    reacher.accountId &&
    (await getMembership(env, liveDoc.teamId, reacher.accountId))?.status === 'joined'
  ) {
    return true;
  }
  return hasSharedAccess(env, reacher.owner, liveDoc.id);
}
