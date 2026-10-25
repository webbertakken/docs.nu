// /api/account — account self-deletion.

import { deleteAccount } from '../db';
import { FRESH_SESSION_AGE_S } from '../auth/identity';
import { deleteIdentity } from '../db/identity';
import { emailEnabled, sendEmail } from '../email/client';
import { accountDeletedEmail } from '../email/templates';
import { json, missingAuth, notFound } from '../responses';
import type { RouteContext } from './context';

// Account self-deletion (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"). Session-only,
// with no X-Owner-Id fallback, because the entire purpose is to wipe data bound to a verified account. The data
// goes first, then the identity (the account row, its sessions and sign-in methods), so no row outlives the only
// account able to reach it; a failure between the two leaves an account with no data that can simply be deleted
// again. Idempotent: re-calling with the same account id is a no-op once the rows are gone.
export async function handleAccount(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, sessionAccountId, accountEmail } = ctx;
  if (!(segments[1] === 'account' && segments.length === 2)) return notFound();
  if (request.method === 'DELETE') {
    if (!sessionAccountId) return missingAuth();
    // A LiveDoc session must be fresh to delete (spec "Sessions"); a session carries no auth time.
    const authTime = ctx.sessionAuthTime ?? null;
    if (authTime !== null && Date.now() / 1000 - authTime > FRESH_SESSION_AGE_S) {
      console.info('[auth] session_not_fresh route=/api/account');
      return json({ code: 'SESSION_NOT_FRESH' }, { status: 403 });
    }
    const deleted = await deleteAccount(env, sessionAccountId);
    // The data goes first, then the identity, so no row outlives the only account able to reach it.
    await deleteIdentity(env, sessionAccountId);
    // docs/specs/014-identity/transactional-email.md: a parting confirmation (best-effort, after the rows are gone).
    if (accountEmail && emailEnabled(env)) {
      ctx.waitUntil?.(sendEmail(env, { to: accountEmail, ...accountDeletedEmail(env) }));
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
