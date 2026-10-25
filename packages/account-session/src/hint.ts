// The signed-in hint and the nudge between tabs (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest,
// before the session answers"; D24 in the identity blueprint's DEFAULTS.md).
//
// The hint is a `localStorage` flag the auth bridge writes `1` whenever a session settles signed in and `0` whenever
// it settles signed out. It only picks a default before the session answers (where a new document is saved); it
// never authenticates anything. The channel tells other tabs that this one's account changed, so they re-read the
// session themselves: a message carries nothing a tab acts on.

export const SIGNED_IN_HINT_KEY = 'livediagram:v2:signed-in';
export const ACCOUNT_CHANNEL_NAME = 'livedoc-account';

function pageStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

// True when the last settled session here was signed in, false when it was signed out, null when no page here has
// settled one yet (or storage is refused).
export function readSignedInHint(storage: Storage | null = pageStorage()): boolean | null {
  try {
    const value = storage?.getItem(SIGNED_IN_HINT_KEY) ?? null;
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
}

export function writeSignedInHint(
  signedIn: boolean,
  storage: Storage | null = pageStorage(),
): void {
  try {
    storage?.setItem(SIGNED_IN_HINT_KEY, signedIn ? '1' : '0');
  } catch {
    // Storage refused (private mode, quota): the hint is only a default, and the session is read on every load.
  }
}

// Tell the other tabs of this origin that the account here changed (signed in, signed out, deleted).
export function announceAccountChange(signedIn: boolean): void {
  if (typeof BroadcastChannel !== 'function') return;
  const channel = new BroadcastChannel(ACCOUNT_CHANNEL_NAME);
  channel.postMessage({ signedIn });
  channel.close();
}

// Run `listener` whenever another tab announces an account change. Where BroadcastChannel is missing, the hint's
// own `storage` event stands in. Returns the unsubscribe.
export function onAccountChange(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'function') {
    const channel = new BroadcastChannel(ACCOUNT_CHANNEL_NAME);
    channel.onmessage = () => listener();
    return () => channel.close();
  }
  if (typeof addEventListener !== 'function') return () => {};
  const onStorage = (event: Event) => {
    if ((event as StorageEvent).key === SIGNED_IN_HINT_KEY) listener();
  };
  addEventListener('storage', onStorage);
  return () => removeEventListener('storage', onStorage);
}
