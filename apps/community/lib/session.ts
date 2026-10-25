import {
  createTokenProvider,
  readSession,
  readSignInOffered,
  writeSignInOffered,
} from '@livediagram/account-session';
import { API_BASE } from './config';

// Who is signed in, for My Shares only (docs/specs/025-community/community.md "My Shares"). The rest of the
// Community needs no identity, so the session is read only once My Shares is chosen, through the same plain-`fetch`
// session layer the editor uses (no sign-in library). My Shares is offered unless this browser last learned that
// the host has no sign-in; choosing it on such a host says so.

export type CommunitySession = {
  loaded: boolean;
  signedIn: boolean;
  // Whether this host offers sign-in at all (false on a guest-only host).
  signInAvailable: boolean;
  // Who is signed in (null signed out), so an answer for one account is never shown for another.
  accountId: string | null;
  // A fresh session token for the api's Authorization header; null when signed out.
  getToken: () => Promise<string | null>;
};

// How long My Shares waits for the session read before it gives up and offers Try Again (a network failure): long
// enough for a slow connection, short enough not to look stuck.
export const SESSION_LOAD_TIMEOUT_MS = 10_000;

// Whether to offer My Shares before asking: yes, unless this browser last learned the host has no sign-in.
export function mineMayBeOffered(): boolean {
  return readSignInOffered() !== false;
}

// Reads the session once. Null when the api could not be asked (the caller's timeout offers Try Again).
export async function loadCommunitySession(): Promise<CommunitySession | null> {
  const state = await readSession({ apiBase: API_BASE });
  if (state.status === 'unreachable') {
    console.warn('[community] session_read_failed');
    return null;
  }
  writeSignInOffered(state.status !== 'off');
  const tokens = createTokenProvider({ apiBase: API_BASE });
  return {
    loaded: true,
    signedIn: state.status === 'signed-in',
    signInAvailable: state.status !== 'off',
    accountId: state.status === 'signed-in' ? state.user.id : null,
    getToken: state.status === 'signed-in' ? () => tokens.getToken() : async () => null,
  };
}

// The editor's sign-in page, returning here afterwards (it reads `redirect_url`).
export function signInHref(returnTo: string): string {
  return `/sign-in/?redirect_url=${encodeURIComponent(returnTo)}`;
}
