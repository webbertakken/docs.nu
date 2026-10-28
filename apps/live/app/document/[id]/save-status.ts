// The autosave's sync state. No chrome shows it: the failure
// states each raise a toast (editor-persistence.ts), so silent failures
// (offline, API down, wrong env var pointing at unreachable host) never
// look identical to a successful save.
// 'error' is a save that FAILED and may well work next time (offline, a
// blip, a 5xx). 'forbidden' is a save the server refused outright — the
// share link was revoked, we were removed from the team — which no amount
// of retrying fixes, so it gets its own state and its own wording rather
// than telling the user to check a connection that is fine. 'unauthenticated'
// is a save the server could not tie to the signed-in account (a 401, or no
// session token to send); it is retried, since the session can come back.
// 'tooLarge' is a tab over the server's row cap (a 413): only an edit that
// shrinks it can save, so it is not retried on a timer.
export type SaveStatus =
  'idle' | 'saving' | 'saved' | 'error' | 'unauthenticated' | 'forbidden' | 'tooLarge';
