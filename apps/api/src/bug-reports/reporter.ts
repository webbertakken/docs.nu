// Who sent a bug report (docs/specs/016-platform/bug-reports.md "Filing" step 3): the verified account of any credential,
// else a guest id that proves itself where the host signs them, else no one. Never from the report's body. The same
// reading decides whether a screenshot's viewer is the Bug Tracker's owner, so a bare header never passes for anyone.
import { isAccountIdShape, sha256Hex, type BugReporter } from '@livedoc/api-schema';
import { guestSignatureEnforced } from '../auth/guest-rest';
import { verifyOwnerId } from '../auth/owner-signature';
import type { RouteContext } from '../routes/context';

const ANONYMOUS: BugReporter = { kind: 'anonymous', id: null };

export async function resolveBugReporter(ctx: RouteContext): Promise<BugReporter> {
  if (ctx.verifiedAccountId) return { kind: 'account', id: ctx.verifiedAccountId };
  const guest = ctx.request.headers.get('X-Owner-Id');
  if (!guest) return ANONYMOUS;
  if (isAccountIdShape(guest)) {
    console.warn('[bug-reports] reporter.anonymous', { why: 'account_id_as_guest' });
    return ANONYMOUS;
  }
  if (
    guestSignatureEnforced(ctx.env) &&
    !(await verifyOwnerId(ctx.env, guest, ctx.request.headers.get('X-Owner-Sig')))
  ) {
    console.warn('[bug-reports] reporter.anonymous', { why: 'guest_signature' });
    return ANONYMOUS;
  }
  return { kind: 'guest', id: guest };
}

// Where a reporter's screenshots sit in the bucket: a hash of the id, so a key names no one, or `anonymous`.
export async function reporterTag(reporter: BugReporter): Promise<string> {
  if (reporter.id === null) return 'anonymous';
  return (await sha256Hex(new TextEncoder().encode(reporter.id))).slice(0, 32);
}
