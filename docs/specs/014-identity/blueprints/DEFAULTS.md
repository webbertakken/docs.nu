# Identity blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                 | Default applied                                                                                                                                |
| --- | --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | profile-picture       | How the Clerk URL's source is read           | The first path segment as base64url JSON; any failure is `'unknown'`, never an upload                                                          |
| D2  | profile-picture       | When the published picture is written        | On change only, compared with the last value written on this page                                                                              |
| D3  | profile-picture       | A PUT before the participant row exists      | 404 is accepted; the next change or page load writes it                                                                                        |
| D4  | profile-picture       | How an open socket updates its identity      | A distinct `identity` frame, so a hello keeps meaning "join" and its side effects never re-run                                                 |
| D5  | profile-picture       | How a cursor shows a picture                 | A 14px disc leading the name pill, only when a picture exists                                                                                  |
| D6  | profile-picture       | Several Google accounts linked               | The first in Clerk's `externalAccounts` order                                                                                                  |
| D7  | profile-picture       | Whether a picture fades in                   | No transition: a small swap reads as a flicker when faded                                                                                      |
| D8  | profile-picture       | How a hook reads module-level picture state  | Through the `useSyncExternalStore` snapshot, never beside it: the React Compiler memoizes module reads                                         |
| D9  | profile-picture       | How many comment authors one request reads   | 50 (`MAX_COMMENT_PICTURE_AUTHORS`); later authors show initials                                                                                |
| D10 | auth-and-guest-access | The account id's shape                       | `acct_` and 24 base62 characters: never a UUID (the guest shape) and never Clerk's `user_`, so one prefix test tells them apart                |
| D11 | auth-and-guest-access | When better-auth's schema is checked         | In CI (`identity-schema.test.ts`), not per request: the runtime check costs 15 ms a request and is what hangs a cached instance                |
| D12 | auth-and-guest-access | How sign-in is rate limited                  | Two Cloudflare limiters in front of `/api/auth/*`, like every other limit in the api; better-auth's own limiter off (it would store IPs in D1) |
| D13 | auth-and-guest-access | When cookies are `Secure`                    | Always, except an `http://localhost` base URL for local development                                                                            |
| D14 | auth-and-guest-access | Whether a session keeps the IP address       | Never: blanked before the row is written; the user agent is kept to name the session in Settings                                               |
| D15 | auth-and-guest-access | How long a session lasts                     | 30 days, sliding once a day: a guest-first product should not sign people out weekly                                                           |
| D16 | auth-and-guest-access | When the browser fetches a new session token | 60 s before the current one expires                                                                                                            |
| D17 | auth-and-guest-access | How long the api caches the public keys      | 5 minutes per isolate, re-read at once on an unknown key id                                                                                    |
| D18 | auth-and-guest-access | How often the session-token key rotates      | Every 90 days, the old key verifying for 30 more                                                                                               |
| D19 | auth-and-guest-access | How soon "Send a new code" is allowed        | 30 s after the last send                                                                                                                       |
| D20 | auth-and-guest-access | Which session counts as the sign-up's own    | One created within 60 s of its account                                                                                                         |
| D21 | auth-and-guest-access | How better-auth's version is held            | Pinned exactly; upgrades are their own pull request, since minors remove APIs                                                                  |
| D22 | auth-and-guest-access | Which database holds the identity tables     | The api's existing `DB`, prefixed `identity_`: deletion and the invite claim stay in one database                                              |
| D23 | auth-and-guest-access | Where One Tap shows                          | Landing page and Explorer, guests only, once per page load; never the editor or an auth page                                                   |
| D24 | auth-and-guest-access | How another tab learns of a sign-in          | The `localStorage` hint plus a `BroadcastChannel` nudge; the tab re-reads the session, trusting neither                                        |
| D25 | auth-and-guest-access | Whether a guest's page asks for a session    | Always, once on load: a cleared hint must not hide a live session                                                                              |
