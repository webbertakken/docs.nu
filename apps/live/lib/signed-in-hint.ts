import { readSignedInHint as readStoredHint } from '@livediagram/account-session';

// Whether this browser is probably signed in, answered before the session read does
// (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before the session answers"): the auth bridge
// writes the hint whenever a session settles. No hint, or `0`, is a guest. The answer only picks a default (where a
// new document is saved); every request still authenticates the real way.
export function readSignedInHint(): boolean {
  return readStoredHint() === true;
}
