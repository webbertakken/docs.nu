// /api/account — account self-deletion.

import { deleteAccount } from '../db';
import { FRESH_SESSION_AGE_S } from '../auth/identity';
import { deleteIdentity } from '../db/identity';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// Account self-deletion. Clerk-only — no X-Owner-Id fallback,
// because the entire purpose is to wipe data bound to a
// verified Clerk identity. The client then calls Clerk's
// `user.delete()` to drop the Clerk record too; the order
// (backend first, then Clerk) means a Clerk-delete failure
// leaves the user signed in but with empty data, which they
// can recover from by re-signing-out — vs. losing access to
// Clerk but leaving orphaned rows in D1. Idempotent: re-
// calling with the same Clerk id is a no-op once the rows
// are gone.
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId, clerkEmail } = ctx;
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!clerkUserId) return missingAuth();
    // A LiveDoc session must be fresh to delete (spec "Sessions"); a Clerk session carries no auth time.
    const authTime = ctx.sessionAuthTime ?? null;
    if (authTime !== null && Date.now() / 1000 - authTime > FRESH_SESSION_AGE_S) {
      console.info('[auth] session_not_fresh route=/api/account');
      return json({ code: 'SESSION_NOT_FRESH' }, { status: 403 });
    }
    const deleted = await deleteAccount(env, clerkUserId);
    // The data goes first, then the identity, so no row outlives the only account able to reach it.
    await deleteIdentity(env, clerkUserId);
    // docs/specs/014-identity/transactional-email.md: a parting confirmation (best-effort, after the rows are gone).
    if (clerkEmail && emailEnabled(env)) {
      ctx.waitUntil?.(sendEmail(env, { to: clerkEmail, ...accountDeletedEmail(env) }));
    }
    return json(
      { deleted },
      {
        headers: {
          'Set-Cookie':
            '__Secure-livedoc.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
        },
      },
    );
  }
  return notFound();
}
