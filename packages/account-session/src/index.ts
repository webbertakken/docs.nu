// The browser's account session (docs/specs/014-identity/auth-and-guest-access.md "Sessions"): what a page asks the
// api about who is signed in, the session token it sends, signing out, and the hint and nudge shared between tabs.
// Plain `fetch`, no auth library: this rides the editor's first load (the sign-in pages load better-auth's client on
// their own).

export { authUrl, readSession, signOut } from './session';
export type { AccountUser, ApiOptions, SessionState } from './session';
export { createTokenProvider, expiryOf, SESSION_TOKEN_REFRESH_MARGIN_S } from './token-provider';
export type { TokenProvider, TokenProviderOptions } from './token-provider';
export {
  ACCOUNT_CHANNEL_NAME,
  announceAccountChange,
  onAccountChange,
  readSignedInHint,
  readSignInOffered,
  SIGN_IN_OFFERED_KEY,
  SIGNED_IN_HINT_KEY,
  writeSignedInHint,
  writeSignInOffered,
} from './hint';
