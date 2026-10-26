# Auth + guest access: blueprint

Derived from [Auth + guest access](../auth-and-guest-access.md). Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

better-auth facts below were read in its source at tag `v1.7.13` (commit `7f61081`) and, where marked _run_, observed in
a throwaway worker under wrangler 4.148 with a local D1. Everything else about LiveDoc was read in this repository.

## Files

| File                                                                                 | Role                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/package.json`                                                              | `better-auth` pinned exactly (`1.7.13`, D21): minors ship breaking changes                                                                                                                      |
| `apps/api/wrangler.toml`                                                             | `compatibility_flags = ["nodejs_compat"]`; rate limiters `AUTH_RATE_LIMITER` (`7013`), `AUTH_EMAIL_RATE_LIMITER` (`7014`)                                                                       |
| `apps/api/migrations/0100_identity.sql`                                              | The identity tables (generated, never hand-written)                                                                                                                                             |
| `apps/api/migrations/0101_email_outbox.sql`                                          | The outbox table                                                                                                                                                                                |
| `apps/api/migrations/0102_drop_auth_sightings.sql`                                   | Drops `auth_sessions`, `auth_accounts` (sign-ins are counted by the hooks)                                                                                                                      |
| `apps/api/scripts/identity-schema.mts`                                               | Replays every migration into `node:sqlite`, asks better-auth for the diff, writes the next `NNNN_identity_*.sql`                                                                                |
| `apps/api/src/auth/identity-config.ts`                                               | Pure: `identityConfigOf(env)` → `{ enabled, methods, googleClientId }`; `versionedSecrets`, `MIN_SECRET_LENGTH`                                                                                 |
| `apps/api/src/auth/identity.ts`                                                      | `createIdentity(env, ctx)`: the better-auth instance for one request, or null when off                                                                                                          |
| `apps/api/src/auth/identity-hooks.ts`                                                | `databaseHooks`: account id, telemetry, welcome email, IP blanking                                                                                                                              |
| `apps/api/src/auth/session-token.ts`                                                 | `getAccountSession(env, token)` verifies a session token in-process                                                                                                                             |
| `apps/api/src/auth/account-id.ts`                                                    | `generateAccountId()`                                                                                                                                                                           |
| `apps/api/src/auth/account-gate.ts`                                                  | Administration routes refuse a session token whose account row is gone (`401 account_not_found`)                                                                                                |
| `apps/api/src/auth/guest-key.ts`                                                     | `guestSigningKey(env)`: HKDF from the oldest usable sign-in secret, or null                                                                                                                     |
| `apps/api/src/auth/owner-signature.ts`                                               | Signs and verifies guest ids with `guestSigningKey`                                                                                                                                             |
| `apps/api/src/auth/guest-rest.ts`                                                    | `guestSignatureEnforced(env)`: true whenever the guest key exists                                                                                                                               |
| `apps/api/src/routes/auth.ts`                                                        | `/api/auth/*`: 404 when off, rate limits, freshness gate, then `identity.handler(request)`                                                                                                      |
| `apps/api/src/routes/account.ts`, `db/account.ts`                                    | `DELETE /api/account`: freshness, data, then `deleteIdentity`                                                                                                                                   |
| `apps/api/src/routes/migrate.ts`                                                     | Guest → account migration, session only, signature always required                                                                                                                              |
| `apps/api/src/routes/capabilities.ts`                                                | `authEnabled`, `signInMethods`, `googleClientId`, `emailOutbox`                                                                                                                                 |
| `apps/api/src/routes/context.ts`, `src/index.ts`                                     | `sessionAccountId`, `verifiedAccountId`, `accountEmail`; the credential resolution                                                                                                              |
| `apps/api/src/email/transport.ts`                                                    | The email port: the outbox (`EMAIL_OUTBOX=1`), the Cloudflare `EMAIL` binding, or Resend, first configured wins                                                                                 |
| `apps/api/src/email/client.ts`                                                       | `sendEmail` (best-effort) and `sendEmailNow` (answers the outcome, for sign-in codes) over the port                                                                                             |
| `apps/api/src/routes/preview-outbox.ts`                                              | `GET /api/preview/outbox?to=`: the newest kept message, outbox hosts only                                                                                                                       |
| `apps/api/src/db/identity.ts`                                                        | `deleteIdentity`, `accountExists`, the expiry and outbox sweeps                                                                                                                                 |
| `packages/api-schema/src/request-auth.ts`                                            | `ACCOUNT_ID_PREFIX`, `isAccountIdShape` (`acct_` only)                                                                                                                                          |
| `packages/api-schema/src/index.ts`                                                   | `Capabilities.signInMethods`, `googleClientId`, `emailOutbox`; `SignInMethod`                                                                                                                   |
| `packages/api-schema/src/profile-picture.ts`                                         | `PROFILE_PICTURE_HOST` (`lh3.googleusercontent.com`), `isProfilePictureUrl`                                                                                                                     |
| `packages/account-session/`                                                          | Browser, plain `fetch`: `readSession`, `createTokenProvider`, `signOut`, the signed-in hint, the sign-in-offered memory, the tab nudge. Used by `apps/live`, `apps/community` and `packages/ui` |
| `packages/ui/src/HeaderPrimaryCta.tsx`, `packages/ui/src/browser-repair/identity.ts` | Read the signed-in hint (public sites, the Repair report)                                                                                                                                       |
| `packages/ui/src/profile-picture.ts`                                                 | `pictureSrc`: Google's `=s<px>-c` size option                                                                                                                                                   |
| `apps/live/lib/auth-config.ts`                                                       | Runtime sign-in availability: `useSignInAvailable`, `useSignInMode`, `useAuthConfig`, `signInOfferedHere`                                                                                       |
| `apps/live/lib/auth-client.ts`                                                       | `createAuthClient` with `emailOTPClient`; imported by the auth pages, and lazily by `lib/reverify.ts`                                                                                           |
| `apps/live/lib/auth-errors.ts`                                                       | The one sentence each auth failure shows (`authErrorCopy`, `googleReturnError`)                                                                                                                 |
| `apps/live/lib/reverify.ts`                                                          | Verifying again with a code before deleting the account                                                                                                                                         |
| `apps/live/components/providers/AuthBridge.tsx`                                      | Reads the session on every page and publishes `DeferredAuthState`; stands down on the workbench route                                                                                           |
| `apps/live/components/providers/deferred-auth.tsx`                                   | The contract: `accountId`, `user`, `getToken`, `signOut`, `deleteAccount`                                                                                                                       |
| `apps/live/hooks/persistence/useAccountApiBootstrap.ts`                              | Token provider registration and the guest migration; `accountId`, `accountDisplayName`                                                                                                          |
| `apps/live/components/chrome/AuthFlow.tsx`, `EmailCodeStep.tsx`, `auth-shared.tsx`   | Both auth pages' flow, the code step, the card and the `redirect_url` guards                                                                                                                    |
| `apps/live/app/sign-in/page.tsx`, `apps/live/app/get-started/page.tsx`               | `AuthFlow` in its two openings; same `AuthStage` frame                                                                                                                                          |
| `apps/live/components/dialogs/DeleteAccountDialog.tsx`                               | Typed email, then delete; a stale session verifies again with a code first                                                                                                                      |
| `apps/live/lib/signed-in-hint.ts`, `lib/account-avatar.ts`                           | The hint for `/new`; the picture and the initial                                                                                                                                                |
| `apps/community/lib/session.ts`                                                      | My Shares reads the session through `account-session` when chosen                                                                                                                               |
| `packages/source-ast/src/clerk-free.test.ts`                                         | The repo check that the earlier provider is named nowhere in the code                                                                                                                           |

## Domain and naming

| Spec term            | Identifier                                                                  | Banned synonyms in new code                |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| account              | `account`; type `Account`                                                   | user (except better-auth's own API)        |
| account id           | `accountId`; `ACCOUNT_ID_PREFIX = 'acct_'`; `isAccountIdShape`              | userId, clerkUserId, sub (outside the JWT) |
| session              | better-auth session; cookie `__Secure-livedoc.session_token`                | Clerk session                              |
| session token        | the 15-minute JWT; `getAccountSession`, `AccountSession`                    | Clerk JWT, auth JWT                        |
| session account      | `ctx.sessionAccountId`: the account a session token proves (administration) | clerkUserId                                |
| verified account     | `ctx.verifiedAccountId`: session, token or workbench owner (content access) | verifiedUserId                             |
| account email        | `ctx.accountEmail`: the verified email claim, or null                       | clerkEmail                                 |
| sign-in method       | `SignInMethod = 'google' \| 'email-code'`                                   | provider (except Google's)                 |
| email code           | better-auth `emailOTP`; UI copy "code"                                      | OTP in copy, magic code                    |
| guest id             | `guestOwnerId`, header `X-Owner-Id`                                         | anonymous user                             |
| guest signature      | `guestSignature`, header `X-Owner-Sig`                                      | owner sig                                  |
| identity tables      | `identity_*`                                                                | auth tables, user table                    |
| identity             | `createIdentity`, the better-auth instance                                  | auth (as a variable name)                  |
| `AI_REQUIRE_ACCOUNT` | replaces `AI_REQUIRE_CLERK`                                                 | `AI_REQUIRE_CLERK`                         |

No identifier, env var, comment, copy string or path names the earlier sign-in provider (Clerk) in `apps/`,
`packages/`, `.github/` or `scripts/`: `packages/source-ast/src/clerk-free.test.ts` fails on any case-insensitive
mention in a tracked file's path or text there, except CHANGELOG files, `*.generated.*` files and the api's migrations
`0000` to `0099` (applied history, never edited).

## Behaviour and state

### Identity on or off

`identityConfigOf(env)` is pure and total:

| `BETTER_AUTH_SECRET` | Google keys (`GOOGLE_AUTH_CLIENT_ID` + `GOOGLE_AUTH_CLIENT_SECRET`) | Email sender | `enabled` | `methods`                                  |
| -------------------- | ------------------------------------------------------------------- | ------------ | --------- | ------------------------------------------ |
| unset                | any                                                                 | any          | false     | `[]`                                       |
| set, < 32 chars      | any                                                                 | any          | false     | `[]`, logs `[auth] secret_too_short`       |
| set                  | both                                                                | none         | true      | `['google']`                               |
| set                  | none or one                                                         | yes          | true      | `['email-code']`                           |
| set                  | both                                                                | yes          | true      | `['google', 'email-code']`                 |
| set                  | none or one                                                         | none         | false     | `[]`, logs `[auth] secret_without_methods` |

One Google key without the other logs `[auth] google_half_configured`. The email sender is "configured" when the
`EMAIL` binding exists or `RESEND_API_KEY` is set. Logs fire once per isolate.

### The instance

`createIdentity(env, executionCtx)` returns null when `enabled` is false, else
`betterAuth({...})` built **per request** (D11):

- `database: env.DB` (better-auth's native D1 dialect; no Kysely or Drizzle of ours).
- `baseURL: env.APP_BASE_URL`, `basePath: '/api/auth'`, `secret: env.BETTER_AUTH_SECRET` (or `secrets` from
  `BETTER_AUTH_SECRETS` when set). Static, never the dynamic `allowedHosts` form: each deployment has one canonical
  host, and the dynamic form answers an unlisted host with 500 and trusts every listed host as an origin.
- `trustedOrigins: [origin of APP_BASE_URL]`.
- `advanced`: `useSecureCookies` true unless `APP_BASE_URL` is `http://localhost…` (D13); `cookiePrefix: 'livedoc'`;
  `ipAddress.ipAddressHeaders: ['cf-connecting-ip']`; `database.generateId` for the user model only →
  `generateAccountId()`, other models the default; `database.validateSchema: false` (the schema is checked in CI, D11); No `backgroundTasks` handler: better-auth would then send a code in the background and answer success whatever
  happened. It swallows a throw from the send callback anyway, so a failed send is recorded on the request's
  `CodeSend` and `routes/auth.ts` answers `502 EMAIL_SEND_FAILED`.
- `telemetry: { enabled: false }` (better-auth's default is already off and needs a build-time endpoint; this makes it
  explicit).
- `rateLimit: { enabled: false }`: LiveDoc's own Cloudflare limiters gate `/api/auth/*` before the handler (D12).
- `session: { expiresIn: SESSION_EXPIRES_IN_S, updateAge: SESSION_UPDATE_AGE_S, freshAge: FRESH_SESSION_AGE_S }`;
  cookie cache off (a revoked session must stop at once).
- `account: { accountLinking: { enabled: true, allowDifferentEmails: false, requireLocalEmailVerified: true,
updateUserInfoOnLink: false }, encryptOAuthTokens: true }`. Google's access and refresh tokens are not stored
  (`mapProfileToUser` keeps name, email, picture; the account row's token columns are written null by an
  `account.create.before` hook).
- `user: { deleteUser: { enabled: false } }`: deletion is LiveDoc's own route. `changeEmail` off (first release).
- `socialProviders.google` when on: `clientId`, `clientSecret`, `prompt: 'select_account'`, scopes
  `openid email profile` only.
- Plugins: `emailOTP` (length 6, `expiresIn` 300, `allowedAttempts` 3, `storeOTP: 'hashed'`,
  `sendVerificationOTP` → `EmailSender.sendNow`), `jwt` (below). Nothing else: no
  `anonymous`, `bearer`, `organization`, `deviceAuthorization`, `twoFactor`, `passkey`,
  `apiKey`.
- `jwt`: `jwks.keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' }`, `jwks.rotationInterval: JWKS_ROTATION_S`,
  `jwks.gracePeriod: JWKS_GRACE_S`, `jwt.issuer` and `jwt.audience` = origin of `APP_BASE_URL` (pinned: a dynamic base
  would let them follow the host), `jwt.expirationTime: '15m'`, `jwt.definePayload: ({ user, session }) =>
({ email: user.email, email_verified: user.emailVerified, auth_time: seconds(session.createdAt) })`.

Per-request construction measured _run_ at 2 to 3 ms with `validateSchema: false` (17 to 21 ms with it on). It also
sidesteps better-auth issues #10315 and #11651 (an isolate-cached instance whose first request is aborted hangs every
later request in that isolate).

### The identity tables

Generated by `identity-schema.mts` from the instance's options with only `modelName` changed: columns keep better-auth's own camelCase names, so an upgrade never needs a field map kept in step
(_run_: the generator emitted plain SQL that `wrangler d1 migrations apply` applied):

| Table                    | Columns                                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_users`         | `id` PK (`acct_…`), `name`, `email` UNIQUE, `emailVerified`, `image`, `createdAt`, `updatedAt`                                                                                                                                                                                         |
| `identity_sessions`      | `id` PK, `userId` → users ON DELETE CASCADE, `token` UNIQUE, `expiresAt`, `ipAddress` (never written, D14), `userAgent`, `createdAt`, `updatedAt`                                                                                                                                      |
| `identity_accounts`      | `id` PK, `userId` → users CASCADE, `accountId` (Google `sub`), `providerId`, `accessToken`, `refreshToken`, `idToken` (all null, above), `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password` (null), `createdAt`, `updatedAt`. An email-code account has no row here. |
| `identity_verifications` | `id` PK, `identifier` (`sign-in-otp-<email>`), `value` (hashed code and tries), `expiresAt`, `createdAt`, `updatedAt`                                                                                                                                                                  |
| `identity_jwks`          | `id` PK (the `kid`), `publicKey` (JWK JSON), `privateKey` (encrypted with the secret), `createdAt`, `expiresAt`, `alg`, `crv`                                                                                                                                                          |

Dates are ISO strings, so an ISO cutoff compares in order.

They live in the same `DB` as everything else (D22): deletion can then remove data and identity in one request, and the
team invite claim and the owner-keyed list stay one database. Existing `auth_sessions` / `auth_accounts` (telemetry
sightings, migration 0047) are dropped; nothing else is named `identity_*` today.

### Credential resolution (in `src/index.ts`)

```text
bearer = bearerTokenOf(Authorization)
if bearer starts lvd_      → resolveApiToken           (refused 401 invalid_token when it does not resolve)
elif bearer starts lvw_    → resolveWorkbenchSession   (refused 401 invalid_session)
elif bearer                → getAccountSession(env, bearer)   (null → guest fall-through, logged)
X-Owner-Id                 → guest, after the shape and signature gates
sessionAccountId   = accountSession?.accountId ?? null
verifiedAccountId  = sessionAccountId ?? token?.ownerId ?? workbench?.ownerId ?? null
accountEmail       = accountSession?.emailVerified ? accountSession.email : null
resolveOwner()     = verifiedAccountId ?? X-Owner-Id ?? null
```

Token prefixes are checked first because they are cheap string tests and a session token never starts with either.

`getAccountSession(env, token)`:

1. Null when identity is off.
2. `jwtVerify(token, localJwks, { issuer, audience, algorithms: ['EdDSA'], clockTolerance: SESSION_TOKEN_SKEW_S })`.
3. `localJwks` is `createLocalJWKSet` over the public keys in `identity_jwks`, cached per isolate for
   `JWKS_CACHE_MS`, re-read once on a `kid` it does not hold (a rotation). No HTTP self-fetch (better-auth issue
   #10888 is a self-fetch 500 on Workers).
4. Returns `{ accountId: sub, email, emailVerified, authTime }`; null on any failure, logging
   `[auth] session_token_rejected reason=<jose code>`.
5. `sub` that is not `isAccountIdShape` is rejected (`reason=not_account_id`).

### Freshness

`isFresh(session) = now - authTime <= FRESH_SESSION_AGE_S`. Checked by `DELETE /api/account` (from the session
token's `auth_time`) and, in `routes/auth.ts`, before `POST /api/auth/unlink-account` and `/link-social` (from
`getSession`'s `session.createdAt`). Stale answers `403 SESSION_NOT_FRESH`; the browser runs the re-verify step and
retries once.

### Sign-in states (browser)

```text
unsettled ──get-session ok, no session──▶ guest ──sign-in done──▶ migrating ──migrate settled──▶ signed-in
    │                                                                  ▲                            │
    └─────get-session ok, session──────────────────────────────────────┘                            │
signed-in ──sign-out / 401 on get-session──▶ guest (hint 0)                                          │
any ──get-session network failure──▶ guest-offline (authLoaded true, isSignedIn false, retried on `online`)
```

- `AuthBridge` reads `GET /api/auth/get-session` once on load for every visitor, guests included (D25). The read also
  settles whether the host offers sign-in: `404` is `off`, any answer is `on`, a network failure leaves it
  `unknown` (`publishSignInAvailability` in `lib/auth-config.ts`).
- Each settled read writes the signed-in hint (`livediagram:v2:signed-in`: `1` signed in, `0` signed out or `off`);
  `guest-offline` writes nothing. Each settled mode writes `livediagram:v2:sign-in-offered` (`1` / `0`), which
  `signInOfferedHere()` reads while the live answer is unknown.
- `authLoaded` is true in `guest`, `signed-in`, `guest-offline`; false in `unsettled` and `migrating`. The bootstrap
  settles a guest after 5 s if the read has not answered.
- The workbench route (`/embed/workbench`) never reads the browser session and holds `DEFERRED_AUTH_PENDING`;
  `WorkbenchAuthBridge` publishes the workbench session to the editor beneath.
- Two tabs (D24): `announceAccountChange` posts `{ signedIn, from }` on `BroadcastChannel('livedoc-account')` after a
  sign-in, sign-out or deletion; every other tab re-reads the session (a tab ignores its own `from`); no tab trusts the
  message itself. Where `BroadcastChannel` is missing, the hint's `storage` event stands in.
- Signing in from an auth page ends with a full page load of the destination, so every page starts from a fresh read.
- Published state (`deferred-auth.tsx`): `authLoaded`, `isSignedIn`, `accountId`, `user` (`id`, `name`, `email`,
  `createdAt`, `pictureUrl`), `getToken`, `signOut({ redirectUrl? })` (ends the session at the api, forgets the token,
  the hint and the recent diagrams, nudges the other tabs), `deleteAccount()` (answers `deleted`, `not-fresh` or
  `failed`). A read that answers the same session keeps the published object, so nothing re-renders.

### Token provider

`createTokenProvider()` in `account-session`: holds the last token and its `exp`; `getToken()` returns it while
`exp - now > SESSION_TOKEN_REFRESH_MARGIN_S`, else `GET /api/auth/token`. `getToken({ skipCache: true })` always
fetches. Concurrent callers share one in-flight fetch. `401` from `/api/auth/token` means signed out: the provider
clears, the bridge moves to `guest`. `getLastKnownToken()` stays for the unload beacon.

### Guest migration

`POST /api/migrate { guestOwnerId, guestSignature }` with a session token (`sessionAccountId`): refused for an
account-shaped source (`isAccountIdShape`) and for a missing or wrong signature; idempotent. There is no
unsigned-to-signed guest upgrade: a browser holding an unsigned guest id on a host that signs is handed a fresh signed
id (`[guest-identity] unsigned_id_replaced`), and the unsigned id's server rows stay unreachable.

### Deletion

`DELETE /api/account`: `sessionAccountId` required (`401` otherwise); fresh (`403 SESSION_NOT_FRESH`); then
`deleteAccount(env, id)` (unchanged owner-keyed sweep); then `deleteIdentity(env, id, email)`:
`DELETE FROM identity_users WHERE id = ?` (cascades sessions and accounts) and
`DELETE FROM identity_verifications WHERE identifier LIKE ?` for the address's pending codes, in one `batch`. Then the
goodbye email (`accountDeletedEmail`) in `waitUntil`, best-effort, to the address `deleteIdentity` read from the account
row before deleting it (none when there was no account, so a repeat delete sends nothing). The response clears the session cookie (`Set-Cookie` with `Max-Age=0`).

In the browser (`DeleteAccountDialog`): the typed email must match; `deleteAccount()` fetches a fresh session token
(`skipCache`) and calls `apiDeleteAccount()`. On `not-fresh` the dialog sends a sign-in code to the account's email
(`lib/reverify.ts`, the same `emailOTP` sign-in, which works for a Google-only account too because its email is
verified), takes the code in `EmailCodeStep` ("Verify and delete"), signs in afresh and deletes once more. A code that
cannot be sent or is refused says so and that nothing was deleted. On `deleted` the bridge forgets the token, the
hint and the recent diagrams, nudges the other tabs, and the dialog signs out to `/`.

### Telemetry and lifecycle hooks

- `user.create.before`: `{ data: { ...user, id: generateAccountId() } }` (belt and braces with `generateId`).
- `user.create.after`: `Session·SignedUp` (server event), `email_lifecycle` insert, welcome email via `waitUntil`.
- No IP is recorded at all: `advanced.ipAddress.disableIpTracking` (D14); LiveDoc's limiters read the IP themselves.
- `session.create.after`: `Session·SignedIn` unless the user was created within `SIGN_UP_SESSION_WINDOW_MS` (that
  session is the sign-up's own).
- Hooks never throw into the sign-in: each catches and logs `[auth] hook_failed hook=<name>`.

## Interfaces and contracts

| Method + path                                                                                                                                                     | Who                       | Answer                                                                                | Refusals                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/capabilities`                                                                                                                                           | anyone                    | adds `authEnabled`, `signInMethods: SignInMethod[]`, `googleClientId: string \| null` |                                                                                                 |
| `* /api/auth/*`                                                                                                                                                   | better-auth's own         | better-auth's documented bodies                                                       | `404` when off; `429 RATE_LIMITED`; `403 SESSION_NOT_FRESH`; `403 INVALID_ORIGIN` (better-auth) |
| `POST /api/auth/email-otp/send-verification-otp`                                                                                                                  | anyone                    | `{ success: true }`                                                                   | `400 INVALID_EMAIL`; `429`; `502 EMAIL_SEND_FAILED`                                             |
| `POST /api/auth/sign-in/email-otp`                                                                                                                                | anyone                    | sets the session cookie; `{ user, token }`                                            | `400 INVALID_OTP`, `TOO_MANY_ATTEMPTS`, `OTP_EXPIRED`                                           |
| `POST /api/auth/sign-in/social`                                                                                                                                   | anyone                    | `{ url }` to Google                                                                   | `400` unknown provider                                                                          |
| `GET /api/auth/callback/google`                                                                                                                                   | Google                    | `302` to `callbackURL`, or to the start page `?error=<code>`                          |                                                                                                 |
| `GET /api/auth/get-session`                                                                                                                                       | browser                   | `{ session, user } \| null`                                                           |                                                                                                 |
| `GET /api/auth/token`                                                                                                                                             | browser with cookie       | `{ token }`                                                                           | `401`                                                                                           |
| `GET /api/auth/jwks`                                                                                                                                              | anyone                    | the public keys                                                                       |                                                                                                 |
| `GET /api/auth/list-sessions`, `POST /revoke-session`, `/revoke-other-sessions`, `/sign-out`, `/update-user`, `/link-social`, `/unlink-account`, `/list-accounts` | session                   | better-auth's                                                                         | as better-auth; link and unlink also `403 SESSION_NOT_FRESH`                                    |
| `DELETE /api/account`                                                                                                                                             | session token             | `{ deleted }`, cookie cleared                                                         | `401 unauthenticated`, `403 SESSION_NOT_FRESH`                                                  |
| `POST /api/migrate`                                                                                                                                               | session token             | `{ migrated }`                                                                        | `400 guestOwnerId is required`, `403` bad signature or account-shaped id                        |
| `GET /api/preview/outbox?to=`                                                                                                                                     | anyone, outbox hosts only | `{ subject, text, createdAt }` of the newest message to that address                  | `404` unless `EMAIL_OUTBOX=1`                                                                   |

- `callbackURL`, `newUserCallbackURL`, `errorCallbackURL` are built by the page from `isSafeInternalPath` and are
  always same-origin paths; better-auth rejects anything outside `trustedOrigins` as well.
- The session token's claims: `iss`, `aud`, `sub` (account id), `iat`, `exp`, `email`, `email_verified`,
  `auth_time`. Nothing else is read.
- OpenAPI (`apps/api/src/openapi/manifest.ts`): the bearer scheme reads "A LiveDoc session token or an API token
  (`lvd_…`)"; `clerk` and `guest-or-clerk` auth kinds become `session` and `guest-or-session`. better-auth's own routes
  are not in LiveDoc's OpenAPI document (they are documented by better-auth).

## Data and persistence

| Field                          | Class                                                                               | Snapshot / restore      | Deletion                             |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| `identity_users.*`             | personal data (email, name, picture URL)                                            | D1 Time Travel only     | `deleteIdentity`                     |
| `identity_sessions.user_agent` | personal data                                                                       | not restored on purpose | cascade; expired rows swept daily    |
| `identity_sessions.token`      | credential (random, stored as-is by better-auth; the cookie carries it HMAC-signed) | never exported          | cascade                              |
| `identity_accounts.account_id` | personal data (Google subject)                                                      | D1 Time Travel only     | cascade                              |
| `identity_verifications.value` | credential (hashed code)                                                            | never                   | expiry sweep; `deleteIdentity`       |
| `identity_jwks.private_key`    | secret (encrypted with the auth secret)                                             | never                   | never (rotation keeps the grace key) |

- **Owner-keyed list** ([API](../../015-api/api.md#owner-keyed-data)) gains `identity_users.id`, `identity_sessions.userId`,
  `identity_accounts.userId` (all "Account-only; deleted by `deleteIdentity`") and loses `auth_accounts.owner_id`.
  `identity_verifications.identifier` is an email, not an owner id.
- **Daily cron** (`0 3 * * *`, existing): `DELETE FROM identity_sessions WHERE expires_at < now`,
  `DELETE FROM identity_verifications WHERE expires_at < now`.
- **Migration from Clerk:** none. docs.nu has no Clerk accounts; a self-host that ran Clerk keeps its old `user_…`
  rows unreachable, documented in the self-hosting guide as a manual re-own (`UPDATE … SET owner_id`) per person.
- **Schema drift:** `identity-schema.test.ts` replays every migration and asserts better-auth reports no pending
  change; a better-auth upgrade that wants a column fails CI until `identity-schema.mts` has written the migration.

## Errors and edge cases

| Case                                                                                                                      | Handling                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email provider down or refusing                                                                                           | `502 EMAIL_SEND_FAILED`; copy "We couldn't send the code. Try again in a minute."; log `[auth] code_send_failed provider=<p> status=<s>`                                                                                                        |
| Too many attempts (either limiter)                                                                                        | `429 RATE_LIMITED`; copy "Too many attempts. Wait a minute and try again."                                                                                                                                                                      |
| Two code requests at once for one address (better-auth #11181)                                                            | The second rotates the first; the code step always says "Use the newest code if you asked for more than one."                                                                                                                                   |
| Wrong code                                                                                                                | `INVALID_OTP`; copy "That code isn't right. Check it, or use the newest code we sent."                                                                                                                                                          |
| Wrong code three times                                                                                                    | `TOO_MANY_ATTEMPTS`, code spent; copy "That code has been used up. Send a new one."                                                                                                                                                             |
| Code older than 5 minutes                                                                                                 | `OTP_EXPIRED`; copy "That code has expired. Send a new one."                                                                                                                                                                                    |
| Not an email address                                                                                                      | `INVALID_EMAIL`; copy "Enter a valid email address."                                                                                                                                                                                            |
| Google returns `access_denied` (person cancelled)                                                                         | Back on the start page, no error banner                                                                                                                                                                                                         |
| Google email unverified (rare Workspace)                                                                                  | `account_not_linked` when an account has the address; copy "That Google account isn't verified for this email. Sign in with an email code instead."                                                                                             |
| Any other failure, or one with no code                                                                                    | Copy "Something went wrong. Try again."; a failed fetch: "We couldn't reach the server. Check your connection and try again." The server's own wording is never shown                                                                           |
| D1 write fails mid sign-up (D1 has no transactions; better-auth writes user, then session or Google account, in sequence) | Nothing to repair: an email-code user is found by address on the next try (email codes write no `identity_accounts` row at all), and a Google user missing its account row is linked again on the next Google sign-in, its email being verified |
| `/api/auth/token` 401 while the page thinks it is signed in                                                               | Bridge to `guest`, hint `0`, `sessionEnded`; the warning toast "You've been signed out. Sign in again to keep working in your account." (`SessionEndedNotice`, also after a sign-out in another tab); owner data reloads as guest               |
| Sign-out cannot reach the api                                                                                             | The browser forgets the session anyway and logs `[auth] sign_out_failed`; the next read shows whether the cookie still lives                                                                                                                    |
| Session read fails (offline, 5xx)                                                                                         | `guest-offline`: settled as a guest, nothing written, read again on `online`                                                                                                                                                                    |
| Migration fails                                                                                                           | Settles, retries next load, 10 s cap                                                                                                                                                                                                            |
| Sign-in reached through the preview's workers.dev host                                                                    | better-auth `403 INVALID_ORIGIN`; copy "Sign-in works only at this site's main address. Open it there and try again."                                                                                                                           |
| `APP_BASE_URL` unset with identity on                                                                                     | `enabled` false, log `[auth] base_url_missing`                                                                                                                                                                                                  |
| Secret changed without `BETTER_AUTH_SECRETS`                                                                              | Every session invalid; JWT keys undecryptable: `/api/auth/token` 500 logged `[auth] jwks_undecryptable`; documented, never silent                                                                                                               |
| Deleted account's token still within 15 minutes                                                                           | `getAccountSession` verifies, but the account row is gone: `auth/account-gate.ts` answers `401 account_not_found` on every administration segment, logged `[auth] account_not_found route=<seg>`                                                |
| Delete with a session older than 10 minutes                                                                               | `403 SESSION_NOT_FRESH`; the dialog verifies again with a code and retries once                                                                                                                                                                 |
| Account id in `X-Owner-Id`                                                                                                | `401 account_id_not_a_guest_credential`                                                                                                                                                                                                         |
| Unsigned guest id on a host that signs                                                                                    | Owner-scoped routes refuse it (`401 signature_required`); the browser takes a fresh signed id; the old id's rows stay unreachable                                                                                                               |

## Security and trust

- **Trust boundary:** only `getAccountSession` turns a bearer into an account; only `routes/auth.ts` hands requests to
  better-auth. Neither reads a forwarded host header (`trustedProxyHeaders` stays off).
- **CSRF:** the session cookie is read only under `/api/auth/*`, where better-auth checks `Origin` against
  `trustedOrigins` whenever a cookie is present (_run_: a cross-site POST with a cookie was refused 403). Cookie-less
  better-auth POSTs (sending a code) are gated by the Cloudflare limiters. The rest of the api reads only `Bearer`.
- **Same site is not same origin:** `<branch>.preview.docs.nu` is same-site with `docs.nu`, so `SameSite=Lax` alone
  would let a preview's page send docs.nu's cookie. Host-only cookies plus the origin check close it: docs.nu trusts no
  preview origin.
- **Rate limits** (D12): `AUTH_RATE_LIMITER` 20 per 60 s per IP on every `POST /api/auth/*`;
  `AUTH_EMAIL_RATE_LIMITER` 3 per 60 s per SHA-256 of the lower-cased address on the code send. Absent bindings
  (self-host) allow, logged once.
- **Enumeration:** the code send answers the same for known and unknown addresses.
- **Secrets:** `BETTER_AUTH_SECRET` (or `BETTER_AUTH_SECRETS`), `GOOGLE_AUTH_CLIENT_SECRET`, `RESEND_API_KEY` are
  worker secrets; `GOOGLE_AUTH_CLIENT_ID` and `APP_BASE_URL` are vars; nothing reaches a bundle except the Google
  client id through `/api/capabilities`.
- **Not relying on `NODE_ENV`:** better-auth guards its default secret and enables its own limiter only when
  `NODE_ENV === 'production'`, which a deployed worker does not set. Every one of those is set explicitly above.
- **Guest signing key:** `HKDF(SHA-256, secret, salt 'livedoc', info 'livedoc-guest-id')`, so the session secret and
  the guest key never sign the same bytes. The secret is the oldest usable one (`guestKeySecret`): `BETTER_AUTH_SECRET`,
  else the lowest version in `BETTER_AUTH_SECRETS`, so a rotation never re-keys guests; retiring that secret does. A
  host with a secret but no sign-in method is guest-only yet still signs and enforces guest ids.
- **Browser:** the session cookie is host-only and read only by `/api/auth/*`; the browser calls it same-origin
  (`credentials: 'same-origin'`), so a page served from another origin than its api reads as signed out. No sign-in
  script from any other origin loads: the Trusted Types script origins name only Google's Drive libraries, and no
  `blob:` worker is allowed.

## Performance and limits

- **Bundle:** the api worker is 7.9 MiB, 2.44 MiB gzip today (`wrangler deploy --dry-run`). better-auth core with
  `emailOTP`, `jwt` and Google adds about 220 KiB gzip (_run_: core alone 219 KiB; the full plugin set
  376 KiB). About 2.7 MiB gzip against the paid plan's 10 MiB.
- **Hot path:** a request with a session token costs one Ed25519 verify (sub-millisecond) and, once per
  `JWKS_CACHE_MS` per isolate, one indexed D1 read. No D1 read per request for identity.
- **Instance:** 2 to 3 ms per `/api/auth/*` request (per-request build, D11).
- **Browser:** no auth library on the landing page or the editor's first load. The bridge is `account-session`
  (plain `fetch`, about 2 KiB); `auth-client` loads only on the auth pages and, lazily, when deleting the account asks for a code.
- **D1 writes:** sign-in writes 2 to 4 rows; a session slides once a day; the token endpoint writes nothing.

## Presentation and UX

- `/sign-in`, `/get-started`: the `AuthStage` frame (one flow, `AuthFlow`). Card contents, in order: heading
  ("Welcome back" / "Create your account", the spec's Night Band titles) with its line under it ("Sign in to keep your
  documents with you on every device." / "Free, and everything you made as a guest comes with you."), Google button
  ("Continue with Google", busy "Redirecting…") when on, a divider "or" when both, on `/get-started` "Your name", the
  email field ("Email"), button "Send code" (busy "Sending…"), and the cross-link footer ("New to LiveDoc? Create an
  account" / "Already have an account? Sign in").
- The code step (`EmailCodeStep`), heading "Check your email": "We sent a code to <email>. Use the newest code if you
  asked for more than one.", one field labelled "6-digit code" (`autocomplete="one-time-code"`,
  `inputmode="numeric"`; digits only, a pasted code with spaces or words lands as its six digits, the sixth digit
  submits), "Sign in" button (busy "Signing in…"), links "Use a different email" and "Send a new code" (disabled for
  `CODE_RESEND_COOLDOWN_S`, reading "Send a new code (Ns)").
- On an outbox host (`emailOutbox` in the capabilities) the code step adds a link "This preview sends no email: see the
  code" to `/api/preview/outbox?to=<email>`, opening in a new tab.
- An account with no name yet (an email-code sign-up through `/sign-in`) is asked "What should we call you?" after the
  code: "Your name", "Continue" (busy "Saving…") and "Not now". A Google sign-up asks nothing more.
- Errors sit above the form in `role="alert"` text, one sentence each (copy in [Errors](#errors-and-edge-cases),
  `lib/auth-errors.ts`); a Google round trip that comes back with `?error=access_denied` shows nothing.
- Guest-only host: heading "Sign-in is off here", "Sign-in isn't turned on for this site. Everything works without an
  account." and **Continue as guest** (to `/new`).
- While the capabilities are unknown, the email form shows and Google's place is held, so a late answer never moves
  the form.
- Already signed in on arrival: the "Redirecting…" card, then the destination.
- Deleting the account: the dialog's copy is in [Deletion](#deletion); its verify step reads "You signed in a while ago,
  so confirm it's you before anything is deleted."
- Settings > Account: sections Name, Email, Sign-in methods, Sessions, Delete Account (copy in the
  [Account settings](../profile-and-email-notifications.md) spec when it is folded back).
- Empty states: a sessions list always holds this browser; sign-in methods always hold one.
- Loading: buttons go busy; the card never blanks.

## Accessibility

- Fields carry visible labels; the code field announces "6-digit code"; errors are linked by `aria-describedby` and
  focus moves to the first error.
- "Send a new code" countdown is not announced each second (`aria-live="off"`), only when it becomes available.
- All controls keyboard reachable in visual order; the Google button is a real button.
- Contrast: the Night Band palette already meets AA in both themes; new text uses the same tokens.
- Reduced motion: the card's entrance obeys the existing rule; the code step swaps without animation under it.

## Web Experience

- LCP: auth pages render the card from static HTML; nothing waits on `/api/capabilities` except which buttons show
  (the Google button reserves its space, so a late answer does not shift layout: CLS 0).
- INP: "Send code" disables synchronously and posts; no main-thread work beyond the fetch.
- The landing page and the editor gain no render-blocking script.

## Observability

| Fingerprint                                                                                       | When                                                              |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `[auth] secret_without_methods`, `secret_too_short`, `google_half_configured`, `base_url_missing` | once per isolate at config                                        |
| `[auth] session_token_rejected reason=<code>`                                                     | a bearer that is not a valid session token                        |
| `[auth] rate_limited route=<path> limiter=<name>`                                                 | a 429 from either limiter                                         |
| `[auth] code_send_failed provider=<p> status=<s>`                                                 | the sender refused                                                |
| `[auth] code_sent provider=<p>`                                                                   | a code accepted by the provider (no address)                      |
| `[auth] signed_up method=<m>` / `signed_in method=<m>`                                            | the hooks (no ids)                                                |
| `[auth] session_not_fresh route=<path>`                                                           | freshness refusal                                                 |
| `[auth] hook_failed hook=<name>`                                                                  | a hook threw                                                      |
| `[auth] account_deleted`                                                                          | identity rows removed                                             |
| `[auth] account_not_found route=<seg>`                                                            | an administration call from a deleted account's token             |
| `[auth] guest_signature_refused route=<seg>`                                                      | a guest header without a valid signature on an owner-scoped route |
| `[auth] jwks_reloaded reason=<kid_miss\|ttl>`                                                     | the local JWKS cache refilled                                     |
| `[migrate] moved rows=<n>` / `refused reason=<no_session\|no_guest_id\|account_id\|signature>`    | guest migration                                                   |
| `[auth] session_read status=<s>` (browser, debug)                                                 | each session read the bridge settles                              |
| `[auth] session_ended source=token` (browser, debug)                                              | the token endpoint answered 401                                   |
| `[auth] sign_out_failed` (browser)                                                                | sign-out could not reach the api                                  |
| `[account] delete_failed status=<n>` / `reason=network` (browser)                                 | deleting the account failed                                       |
| `[guest-identity] unsigned_id_replaced` (browser)                                                 | an unsigned guest id replaced by a signed one                     |
| `[community] session_read_failed` (browser)                                                       | My Shares could not read the session                              |

Never logged: tokens, codes, emails, names, IPs.

## Testing

| Spec rule                                                                              | Test                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Modes from configuration                                                               | `auth/identity-config.test.ts` (every row of the table)                                                                       |
| No keys: `/api/auth/*` 404, capabilities off                                           | `routes/auth.test.ts`, `index.auth.test.ts`                                                                                   |
| Capabilities name the methods and the outbox                                           | `routes/capabilities.test.ts`, `index.auth.test.ts`                                                                           |
| Credential order, refusals, fall-through                                               | `index.auth.test.ts`                                                                                                          |
| Session token verify (good, expired, wrong iss/aud/alg, kid rotation, non-account sub) | `auth/session-token.test.ts` (keys minted in the test)                                                                        |
| Account id shape; refused as guest header                                              | `request-auth.test.ts`, `index.auth.test.ts`                                                                                  |
| Guest signing key derived, kept across a rotation, enforced whenever it exists         | `auth/guest-key.test.ts`, `auth/guest-rest.test.ts`, `auth/owner-signature.test.ts`                                           |
| Migration (signature, account-shaped source, idempotent, end to end)                   | `routes/migrate.test.ts`, `index.auth.test.ts`                                                                                |
| Freshness on delete, unlink, link                                                      | `index.auth.test.ts`, `routes/auth.test.ts`                                                                                   |
| Deleted account refused on administration                                              | `auth/account-gate.test.ts`                                                                                                   |
| Deletion removes data then identity, then says goodbye once                            | `db/account.test.ts` (seeded identity rows), `index.auth.test.ts`                                                             |
| Code send failure surfaces                                                             | `email/transport.test.ts`, `routes/auth.test.ts`                                                                              |
| Hooks: SignedUp once, SignedIn not on sign-up; no IP stored                            | `auth/identity-hooks.test.ts`                                                                                                 |
| Telemetry off                                                                          | `auth/identity.test.ts` asserts `telemetry.enabled === false`                                                                 |
| Schema in step with better-auth                                                        | `identity-schema.test.ts`                                                                                                     |
| Session read, token provider caching, hint, tab nudge                                  | `packages/account-session/src/*.test.ts` (100 % coverage)                                                                     |
| Bridge states, sign-out, deletion, workbench stand-down                                | `apps/live/components/providers/AuthBridge.test.tsx`, `WorkbenchAuthBridge.test.tsx`                                          |
| Sign-in availability at runtime                                                        | `apps/live/lib/auth-config.test.tsx`                                                                                          |
| Where `/new` saves before the session answers                                          | `apps/live/app/new/useNewDocumentLocation.test.tsx`, `lib/signed-in-hint.test.ts`                                             |
| One sentence per failure                                                               | `apps/live/lib/auth-errors.test.ts`                                                                                           |
| Delete with re-verification                                                            | `apps/live/components/dialogs/DeleteAccountDialog.test.tsx`, `lib/reverify.test.ts`                                           |
| Safe redirects on every path                                                           | `auth-shared.test.ts`                                                                                                         |
| My Shares session                                                                      | `apps/community/components/auth-and-gate.test.tsx`, `apps/community/components/gallery/GalleryView.test.tsx`                  |
| End to end: email-code sign-up, guest migration, sign-out, delete                      | `apps/live/e2e/account/` `sign-up`, `guest-documents`, `sign-out`, `delete-account` `.spec.ts`, through the outbox, dark mode |
| No earlier provider left                                                               | `packages/source-ast/src/clerk-free.test.ts`                                                                                  |

Google's round trip has no automated test yet: `fake-google` (`packages/fake-google`) serving the OAuth endpoints the
provider calls is the intended stand-in.

## Constants and configuration

| Name                                  | Value                         | Provenance                          | Safe range    |
| ------------------------------------- | ----------------------------- | ----------------------------------- | ------------- |
| `SESSION_EXPIRES_IN_S`                | 2,592,000 (30 d)              | D15                                 | 1 d to 90 d   |
| `SESSION_UPDATE_AGE_S`                | 86,400                        | better-auth default                 | 1 h to 7 d    |
| `FRESH_SESSION_AGE_S`                 | 600                           | spec "10 minutes"                   | 300 to 3,600  |
| `SESSION_TOKEN_TTL_S`                 | 900                           | better-auth `jwt` default           | 300 to 3,600  |
| `SESSION_TOKEN_REFRESH_MARGIN_S`      | 60                            | D16                                 | 10 to 300     |
| `SESSION_TOKEN_SKEW_S`                | 5                             | today's Clerk tolerance             | 0 to 30       |
| `JWKS_CACHE_MS`                       | 300,000                       | D17                                 | 60 s to 1 h   |
| `JWKS_ROTATION_S`                     | 7,776,000 (90 d)              | D18                                 | 30 d to 365 d |
| `JWKS_GRACE_S`                        | 2,592,000 (30 d)              | better-auth default                 | ≥ token TTL   |
| `EMAIL_CODE_LENGTH`                   | 6                             | spec                                | 6 to 8        |
| `EMAIL_CODE_TTL_S`                    | 300                           | spec                                | 120 to 900    |
| `EMAIL_CODE_ATTEMPTS`                 | 3                             | spec                                | 3 to 5        |
| `CODE_RESEND_COOLDOWN_S`              | 30                            | D19                                 | 15 to 60      |
| `AUTH_RATE_LIMIT`                     | 20 / 60 s per IP              | D12                                 | 10 to 60      |
| `AUTH_EMAIL_RATE_LIMIT`               | 3 / 60 s per address          | D12                                 | 1 to 5        |
| `SIGN_UP_SESSION_WINDOW_MS`           | 60,000                        | D20                                 | 10 s to 5 min |
| `GUEST_MIGRATION_WAIT_MS`             | 10,000                        | existing                            | unchanged     |
| `ACCOUNT_ID_PREFIX`, random length    | `acct_`, 24 base62 (143 bits) | D10                                 | ≥ 22 chars    |
| `MIN_SECRET_LENGTH`                   | 32                            | better-auth's own warning threshold | ≥ 32          |
| `SESSION_LOAD_TIMEOUT_MS` (Community) | 10,000                        | existing My Shares wait             | 5 s to 30 s   |

| Env                                                | Kind             | Where                                                                                                                                                  |
| -------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_SECRETS`       | secret           | `wrangler secret put`; deploy syncs `BETTER_AUTH_SECRET` (and `GOOGLE_AUTH_CLIENT_SECRET`) from GitHub secrets when set; `BETTER_AUTH_SECRETS` by hand |
| `GOOGLE_AUTH_CLIENT_ID`                            | var              | `hosted-vars.json` (docs.nu's own client)                                                                                                              |
| `GOOGLE_AUTH_CLIENT_SECRET`                        | secret           | `wrangler secret put`, or the deploy sync above                                                                                                        |
| `APP_BASE_URL`                                     | var              | existing; also the issuer                                                                                                                              |
| `EMAIL` (`send_email` binding) or `RESEND_API_KEY` | binding / secret | either                                                                                                                                                 |
| `EMAIL_OUTBOX`                                     | var              | `1` on previews (`scripts/preview.mjs`) and in the local e2e stack; never on production                                                                |

No frontend build reads a sign-in variable: one static build serves every host. `AI_REQUIRE_ACCOUNT` (api var) limits
AI to signed-in callers. Guest signing has no variable of its own (it derives from `BETTER_AUTH_SECRET`).

## Assets and external resources

| Resource                      | Source / licence                                                                                                      | Where                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `better-auth` 1.7.13          | npm, MIT                                                                                                              | `apps/api`, `apps/live` (`better-auth/react` client)                             |
| Google sign-in client         | Google Cloud project of docs.nu, redirect URI `https://docs.nu/api/auth/callback/google`, JS origin `https://docs.nu` | console, by hand (operations doc)                                                |
| "Continue with Google" button | Google's branding guidelines                                                                                          | `GoogleGlyph` in `apps/live/components/chrome/auth-shared.tsx` (already shipped) |
| Email templates               | LiveDoc's own                                                                                                         | `apps/api/src/email/templates.ts` (`signInCodeEmail`)                            |

## Defaults ledger

D10 to D22 and D24 to D30 in [DEFAULTS.md](DEFAULTS.md), rows `auth-and-guest-access`.
