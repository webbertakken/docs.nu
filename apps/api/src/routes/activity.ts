// /api/activity — the Explorer's Inbox (docs/specs/013-workspace/inbox.md).
//
// GET /api/activity -> { actions: ActivityAction[], threads: ActivityThread[] }
//
// Read-only: the Inbox's Reply and Resolve go through the comment routes every client uses
// (docs/specs/013-workspace/inbox.md §1.5), never a route of the Inbox's own.
//
// Hybrid identity like the rest of the api (docs/specs/014-identity/auth-and-guest-access.md): the account id
// when signed in, X-Owner-Id otherwise. Guests get their own page (their
// self-assigned to-dos, threads on their documents), and it survives
// sign-up through owner_aliases (docs/specs/013-workspace/inbox.md §2.2).

import { ACTIVITY_LIST_MAX } from '@livedoc/api-schema';
import { readActivity } from '../db';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

export async function handleActivity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'activity') return notFound();
  const ownerId = resolveOwner();
  if (!ownerId) return missingAuth();

  if (segments.length === 2 && request.method === 'GET') {
    const result = await readActivity(env, ownerId, { limit: ACTIVITY_LIST_MAX });
    return json(result);
  }

  return notFound();
}
