import { SIGNED_IN_HINT_KEY } from '@livedoc/account-session';
import { GUEST_IDENTITY_KEYS } from './kept-keys';

// Who this browser is, for the diagnostics report (docs/specs/007-editor/load-recovery.md "Diagnostics").
// Readable from any app on the origin, so the help centre's Repair page reports it too, without reading the
// session: the guest identity is plain localStorage, and the auth bridge keeps a signed-in hint there (`1` signed in,
// `0` signed out, docs/specs/014-identity/auth-and-guest-access.md). The hint says whether, not who; the editor adds
// the account id it resolved.
//
// A full guest id is an `X-Owner-Id` credential, so only its first GUEST_ID_PREFIX_LENGTH characters
// ever leave this module.

/** How many characters of a guest id a report carries. */
export const GUEST_ID_PREFIX_LENGTH = 8;

export type BrowserIdentity = {
  /** From the signed-in hint: true / false, or null when there is none (sign-in not set up, never visited). */
  signedIn: boolean | null;
  /** The guest id's first characters, or null when this browser has none. */
  guestIdPrefix: string | null;
  guestSigned: boolean;
};

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function readBrowserIdentity(win: Pick<Window, 'localStorage'> = window): BrowserIdentity {
  const ls = () => win.localStorage;
  const guestId = read(ls, GUEST_IDENTITY_KEYS.selfId);
  const hint = read(ls, SIGNED_IN_HINT_KEY);
  return {
    signedIn: hint === null ? null : hint === '1',
    guestIdPrefix: guestId ? guestId.slice(0, GUEST_ID_PREFIX_LENGTH) : null,
    guestSigned: read(ls, GUEST_IDENTITY_KEYS.selfSig) !== null,
  };
}

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

/**
 * The identity as report lines. `account` is the signed-in account id when the caller knows it (the
 * editor); it also settles "signed in" over the hint.
 */
export function formatBrowserIdentity(
  id: BrowserIdentity,
  account: string | null = null,
): string[] {
  const signedIn = account !== null ? true : id.signedIn;
  const lines = [
    `Signed in: ${signedIn === null ? 'unknown' : yesNo(signedIn)}${account ? ` (${account})` : ''}`,
    id.guestIdPrefix
      ? `Guest id in this browser: ${id.guestIdPrefix}… (signed: ${yesNo(id.guestSigned)})`
      : 'Guest id in this browser: none',
  ];
  // Signing in moves a guest's documents to the account and then clears the guest id, so one still
  // here while signed in means that move has not happened: the classic "my documents went missing".
  if (signedIn && id.guestIdPrefix) {
    lines.push('Guest documents moved to the account: NOT YET (guest id still present)');
  }
  return lines;
}
