# Public API and API tokens

**Status: shipped.** Everything below is live on `main`: API tokens (§3),
the `X-Owner-Id` hardening (§4, §4.1) and the input validation (§5). The guest
signature requirement of §4 holds wherever sign-in is on: its key derives from
`BETTER_AUTH_SECRET`, so a guest-only host signs nothing and requires nothing
([§6](#6-rollout)). This spec sequenced opening the
REST API to external, programmatic callers.

## 1. Goal

Let **signed-in** people call the LiveDoc API from their own scripts /
integrations with a long-lived **API token**, not just from the first-party web
app. Read their documents, create/update them, manage folders — the same surface
the app uses, under an explicit, revocable credential.

**Signed-in only (gated like teams, [Teams](../013-workspace/teams.md)).** API tokens are an
advanced, opt-in feature for users with an account; the canvas, guests, and the
share/realtime flows are unaffected and stay account-free ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
A token always acts as an account; there are **no guest-owned tokens**. This
is a deliberate constraint, not a limitation to apologise for: programmatic API
use is a power-user need, requiring an account for it is reasonable, and it
keeps tokens off the spoofable guest-identity path entirely (the guest REST
hardening in [§4](#4-x-owner-id-trust-change) is a separate track).

This must not weaken the friction-free guest model ([Auth + guest access](../014-identity/auth-and-guest-access.md))
or self-hosting ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## 2. Why the API wasn't safe to expose as-is (history)

**History, not the current API.** This section records the weakness that
motivated §4, as it stood before this work shipped. Every surface it names has
since been closed; [Where it stands now](#where-it-stands-now) says how, and
what is still a deployment switch.

The worker resolved the caller two ways ([Auth + guest access](../014-identity/auth-and-guest-access.md)):

- **Clerk JWT** in `Authorization: Bearer <jwt>`, verified (signature, exp,
  optional issuer/audience) by the api worker's Clerk verifier, since replaced by
  the session token (`apps/api/src/auth/session-token.ts`). Sound.
- **Guest path**: an `X-Owner-Id` header carrying a per-browser UUID, **trusted
  verbatim** by `resolveOwner()` in `apps/api/src/index.ts`, with **no
  signature** on the REST path. (The realtime WS upgrade of the time required an
  HMAC proof, `?g=`; REST did not.)

The guest header was the blocker, and the owner id it carried was **not a
secret in practice.** The obvious REST surfaces were already redacted for
non-owners (the shared document DTO, `redactOwner`; comment author ids on tab
read, `redactCommentAuthorIds`), but two surfaces still exposed a
collaborator to the owner's id:

- **Realtime presence**: `broadcastPresence` (`document-room.ts`, roster in `room-roster.ts`) sent every
  connected participant's `id`, unredacted, to all room peers, and that id was
  the owner id. Any co-present collaborator, including a **view-only** share
  visitor, could read it off a presence frame.
- **Change-log / Activity** (endpoint since removed with the Activity panel, 2026-10-03): `GET /documents/<id>/log` returned each entry's
  `participantId` unredacted to any **edit-access** collaborator (edit-share
  holders, joined team members). A static, reliable harvest.

Because REST trusted `X-Owner-Id` with no signature, a collaborator who
harvested an owner's id could call the API **as** that owner across ALL their
content: `GET /api/documents` listed every document the id owned, each then
readable / editable / deletable. **Sharing one document (or being in a team)
could escalate to impersonating the owner account-wide.** It applied to
signed-in owners too: their id is the Clerk `sub`, and the `X-Owner-Id`
fallback accepted it whenever a request carried no Bearer token.

Conclusion at the time: external access needed a real, server-verifiable
credential, AND the bare `X-Owner-Id` trust had to be replaced, which also
closed the escalation. The fix is [§4](#4-x-owner-id-trust-change).

### Where it stands now

- **The WS upgrade no longer takes `?g=`.** It admits a caller by a one-time
  room ticket minted over authenticated REST (`t`, `routes/document-room-routes.ts`;
  [API app](api.md) "Realtime model"), which every editor session now uses, so no
  owner id, guest signature, share code or share password rides the upgrade URL.
  The legacy legs, a personal document's owner id or a share code with the share
  password where one is set (`o` / `os` / `s` / `p`), still admit an editor from
  before 2026-10-17 and log `[room-upgrade] legacy leg admitted` until they are
  retired.
- **Presence carries no owner id.** The room mints a random presence id per
  socket and builds each presence entry itself (`helloPresence`,
  `document-room-rules.ts`); a client never supplies or learns one.
- **An account id is never a guest credential.** An account-shaped `X-Owner-Id`
  (`acct_…`) is refused on every owner-scoped route with `401
account_id_not_a_guest_credential`, unconditionally ([§4.1](#41-an-account-id-in-x-owner-id-is-refused-unconditionally)).
- **External callers have a real credential**: API tokens ([§3](#3-design-api-tokens)).
- **Guests prove their id wherever sign-in is on.** The signature requirement on
  a _guest_ `X-Owner-Id` (§4) holds whenever the host has a sign-in secret, with
  no grace window. A guest-only host signs nothing, so there a guest id obtained
  some other way still acts as that guest; the surfaces above simply stop
  handing it out. Check the deployment, not the source: `POST /api/guest-id`
  answering `"ownerSig": null` means signing is off.

## 3. Design: API tokens

### 3.1 Token format

- An opaque secret with a visible prefix for greppability + leak-scanning:
  `livedoc_<base64url(32 random bytes)>`. The prefix names the product, so a token
  found in a log or a pasted config says whose it is; it also disambiguates it from a
  session token in the same `Authorization: Bearer` header.
- `API_TOKEN_PREFIX` (`@livedoc/api-schema`) is the one place the prefix is written; the api,
  the CLI and the Settings dialog read it. Tokens minted before it, `lvd_…`, are not
  accepted: when the prefix changed, the one live `lvd_` token was Webber's own.
- Shown **once** at creation; never retrievable again.
- Stored **hashed** (SHA-256), never in plaintext. Auth hashes the presented
  token and looks the hash up by its UNIQUE-indexed column — an indexed
  equality lookup, not a per-row compare: the hash derives from 256 bits of
  randomness, so there's no low-entropy value to time-attack (unlike a
  password) and the lookup leaks nothing useful.

### 3.2 Storage (D1)

A new owner-scoped table, migration with the worker that owns the binding:

```
api_tokens(
  id            TEXT PRIMARY KEY,     -- public token id (for listing / revoke)
  owner_id      TEXT NOT NULL,        -- the account id this token acts as (never a guest id)
  token_hash    TEXT NOT NULL UNIQUE, -- SHA-256 of the secret
  name          TEXT,                 -- user label ("CI bot")
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER NOT NULL,     -- created_at + 6 months; never null, never "forever"
  revoked       INTEGER NOT NULL DEFAULT 0
)
```

Indexed on `token_hash` (lookup) and `owner_id` (listing).

**Lifetime — fixed 6 months.** Every token expires at `created_at + 6 months`.
This is a hard maximum AND the only option: `expires_at` is **never null** (no
never-expires tokens) and there is no shorter / user-chosen value for now — a
long-lived credential that never lapses is the thing we don't want sitting in
someone's CI config forever. `expires_at` is therefore always set and always in
the future at creation; the lookup filters on it (`expires_at > now`) so an
expired token is rejected exactly like a revoked one. **Rotation is manual**:
mint a fresh token before the old one lapses. A configurable or shorter
lifetime can be added later if there's demand; six months is the ceiling
regardless.

### 3.3 Resolution

A token authenticates as its own identity path, resolved once in `fetch`
alongside the session token and the guest header ([API app](api.md#auth) has the
full order, workbench sessions included):

1. `Authorization: Bearer livedoc_…` → hash → look up a non-revoked,
   non-expired row → the request's owner id is the row's `owner_id`; stamp
   `last_used_at`. The column means "the last request this token made, to
   within a minute": a request writes it only when the stored value is older
   than `LAST_USED_STAMP_WINDOW_MS` (60 s, `apps/api/src/db/api-tokens.ts`),
   checked again in the UPDATE's WHERE, so a burst of MCP tool calls (3 to 6
   api requests each) costs one write a minute rather than one per request.
   Its only reader, the Settings token card, works at day grain. (A token and a session token can't both be the bearer.) An `livedoc_`
   bearer with no such row (unknown, revoked or expired), or one too short to be a token at all (cut short or
   mistyped when pasted), is refused there and then with `401 invalid_token` and `WWW-Authenticate: Bearer
error="invalid_token"`, on every route: it never falls through to the guest
   path or to no owner, so a script holding a dead token is told so.
2. Else a session token in `Authorization: Bearer`, when it verifies (a bearer
   with neither prefix).
3. Else the guest `X-Owner-Id` path — requiring a valid HMAC signature on
   the header wherever sign-in is on (see [§4](#4-x-owner-id-trust-change)). Tokens never resolve to a
   guest id, so this path is for the first-party app only; it grants no token.

The resolved owner id flows through the **same** `gateRead` / `gateEdit` /
ownership checks every route already enforces — so a token can only touch what
its `owner_id` owns. No route changes for authorization; only the identity
source changes.

### 3.4 Access — full read + write, with an optional read-only flag

> **Specified, not built:** the read-only flag becomes a token level (view, participate or edit), one vocabulary with
> share links ([Share roles](../013-workspace/share-roles.md#api-tokens)). Read-only tokens become view tokens; the
> rest become edit tokens.

A token grants its owner's **full** access — read AND write, the same surface
the app has — **unless** it was minted **read-only** (the one scope that
exists): a `read_only` column (migration 0039) that, when set, restricts the
token to `GET`/`HEAD`; the api worker rejects every write it presents at a
single dispatch choke point with `403 read_only_token`
([MCP server §4.11](mcp-server.md)). The same choke point refuses it the one read that is a
credential rather than content: `GET /api/documents/:id/share`, whose links and password would let it
open an edit link. Read-only tokens are minted through the MCP
consent screen (a "read-only access" checkbox), giving a cautious user a way to
let an AI tool VIEW their documents without granting edit. There is still no
finer-grained scope vocabulary (per-resource, per-verb); that remains deferred
([§7](#7-out-of-scope-for-now)) — `read_only` is a single boolean, not a general
scopes system.

**Team content counts as "the same surface".** A token's owner is always an
account ([§3.3](#33-resolution)), and both credentials — session token and
API token — are server-verified, so the token identity feeds the same
team-membership checks the session does (`RouteContext.verifiedAccountId`, used by
`gateRead`/`gateEdit` and the team-scoped document/folder verbs). Concretely: a
token can read and edit the documents in the shared libraries of the teams its
owner has joined ([Team shared documents](../013-workspace/team-shared-documents.md)), and can `GET` the
teams surface (list its teams, team detail, a team's library). Without this, a
document filed into a team was invisible to every external integration — the
personal `GET /documents` excludes team documents by design.

**Administration stays interactive-session-only.** Every teams MUTATION
(create, invite, role change, join/accept/leave, invite links, team deletion)
plus token management (`/api/tokens`), account deletion, and guest migration
require a verified **session** (`sessionAccountId`), never a token, and the
session's account must still exist: a session token verifies on its own for 15
minutes, so a deleted account's token gets `401 account_not_found` there
(`requireAccount`, `apps/api/src/auth/account-gate.ts`). Boundary
rationale: a leaked token already exposes the owner's content (that's §3.4's
deal, revocable + 6-month-capped), but it must not be able to escalate — mint
further credentials, grant other people membership, or destroy the account.

**Deleting goes to the Trash, with an explicit way past it.** A token's
`DELETE /api/documents/<id>` moves the document to the [Trash](../013-workspace/trash.md)
like every other delete; `DELETE /api/documents/<id>?permanent=true` deletes it
for good at once (and purges one already in the Trash). The Trash routes
(`GET /api/trash`, `POST /api/trash/<id>/restore`, `DELETE /api/trash[/<id>]`)
are token-usable with the same delete authority; a read-only token may list the
Trash but not restore or purge. The MCP server, by contrast, offers no permanent
delete at all ([MCP server §4.9](mcp-server.md)).

### 3.5 Rate limiting

Key the existing `WRITE_RATE_LIMITER` on the token id (not just the owner) so a
runaway integration is throttled independently of the owner's interactive app
use, and add a read limiter for token reads. Per-IP limits stay as the outer
backstop.

### 3.6 Management — the Settings dialog's API Tokens category

Tokens are created, viewed and revoked in the **Settings dialog**
([User preferences](../007-editor/user-preferences.md)), in the **API Tokens**
sub-category of **Account** (id `tokens`, `parent: 'account'`, shown as
"Account › API Tokens"). It is account-scoped like its parent, and the dialog is reachable
from both the Explorer and the editor, so the tokens are too. There is no
Explorer page for them: the former `/explorer/tokens` route and its sidebar
entry are gone, with no redirect (few people had used it).

The category holds one row, the **token manager** (`kind: 'tokens'`), laid
out top to bottom:

- **Overview.** The row's own header (the key tile, the title and the line on what tokens are for, with Learn more)
  over the **capacity meter**: "3 of 10" over ten pips, one per slot, filled for each
  live token (brand; amber from 8; rose at the cap), with a **New** button beside it (accessible name "New token")
  that opens the composer; at the cap it is disabled and the meter says to revoke one first. The title and line are
  said once: the overview repeated them under the header.
- **Composer.** Opens in place under the overview from New. A name
  field (optional, up to 60 characters, focused when opened) with **suggestion chips** that fill it
  ("Claude", "Cursor", "CI Bot", "Local Script"), a live line saying when the
  token will expire (six months from today, as a date), then **Cancel** and
  **Create Token**. Enter submits, Escape cancels.
- **Reveal.** After a create, the composer becomes an emerald-edged "Token
  Created" card that follows the theme (light in light mode): a "Shown once"
  label and the secret in a monospace field with its `livedoc_` prefix picked out.
  The field copies the way the Share dialog's pass link does: an icon-only copy button inside the field's right edge, with
  a tooltip, that turns into a check once the clipboard write resolves.
  **Done** drops the secret for good; it becomes the primary action once the
  secret has been copied.
- **Token cards**, newest first. Each has a key tile tinted by status, the
  name ("Untitled token" when unnamed), a Read-only badge where set, a meta
  line (created date; last used, with a green dot when used in the last 24
  hours, or "Never used"), and a **lifetime bar**: how much of the six months
  has passed, tinted by status (Active / Expires soon inside 14 days /
  Expired), labelled with the time left. A **Revoke** control per card opens
  a confirmation popover with the revoke warning first.
- **Paired workbenches.** Under a card's lifetime bar, the workbenches the token
  is paired with ([Workbench embeds](../013-workspace/workbench-embeds.md#pairing)),
  read once per account (`GET /api/workbench/pairings`) and grouped by token: each row
  the workbench's name ("Unnamed workbench" when it sent none), its origin in
  monospace, "Paired <relative time>", and an **Unpair** text button that asks
  first in the same popover as Revoke. A token with no pairings shows nothing extra.
- **First run.** With no tokens, the composer is already open and is the
  whole category: no New button, no meter, no Cancel, and no empty-list
  card, so the one thing on screen is the form. It does not take focus on
  load. Under it a single quiet line points readers who want to connect an AI
  tool at the Connect an AI Tool guide, since that flow creates its own token.
  Once a token exists the overview's meter and New button take over.

"Edit" is exactly what the API supports: create and revoke. There is no rename
or scope change; a token is replaced by creating a new one and revoking the old.

**Links to it open the dialog, never navigate.** Everything in the app that
points at tokens opens Settings on the API Tokens category in place: the
AI Tools category's **Manage API Tokens** link row (which replaced the old
read-only token list there), and the timeline's token cards and their
**Open API Tokens** menu verb ([Timeline](../013-workspace/timeline.md)).
Mail, which cannot open a dialog, links at the `?settings=tokens` deep link
(`/explorer?settings=tokens`), which opens the Explorer with Settings on the
category.

**Guests** see the category with the manager replaced by
"Sign in to create API tokens." and a **Sign In** link (see the Settings
sign-in rule in [User preferences](../007-editor/user-preferences.md)).

Behind it, a new `GET/POST/DELETE /api/tokens` surface, **gated exactly like
the team routes** ([Teams](../013-workspace/teams.md)): it requires a verified session
and rejects a guest (`X-Owner-Id`-only) caller outright (`401`/`403`,
mirroring `routes/teams.ts`) — so the manager is inert for guests, the
same way the rest of the signed-in surface is. A token can only ever be minted
by, and act as, a signed-in account. Creation returns the secret **once**
(shown in the manager to copy, never retrievable again); the row then shows only
the public id + metadata. Revoke is immediate (the lookup filters
`revoked = 0`). The category states the fixed 6-month expiry ([§3.2](#32-storage-d1))
so rotation isn't a surprise.

**Per-account cap: 10.** A `POST /api/tokens` is refused (`409`) once the owner
already has 10 live (non-revoked, non-expired) tokens — enough for any real
integration set, low enough to keep the list + table tidy. Revoking or letting
one expire frees a slot. The count is part of the INSERT itself (one
`INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < 10` statement in
`apps/api/src/db/api-tokens.ts`), so concurrent mints, from the Explorer and
the OAuth exchange alike, can never take an account past 10; a refused mint
logs `[api-tokens] mint refused: owner at the token cap` and answers `409
token_limit_reached`.

**Account deletion removes them.** Deleting an account erases ALL of that
user's data, tokens included: `DELETE /api/account` ([`routes/account.ts`](../../../apps/api/src/routes/account.ts))
must delete the owner's `api_tokens` rows in the same cascade as their documents
/ folders / themes, so no credential outlives the account.

### 3.6a A token's view of itself

A token may read and revoke **itself**, which escalates nothing, so the [CLI](cli.md) can show who it is and sign
out cleanly:

- `GET /api/tokens/current`: the account id and display name, the token's name, its role and `expiresAt`.
- `DELETE /api/tokens/current`: revokes the presenting token (204).
- A session or guest has no token to describe and is refused `403 not_a_token`; a revoked token is refused at the
  front door like any dead token (§3.3).

Every other `/api/tokens` route stays session-only.

### 3.7 Self-hosting

API tokens are gated on **sign-in being on**, exactly as teams are
([Teams](../013-workspace/teams.md), [Auth + guest access](../014-identity/auth-and-guest-access.md)). A
self-host that sets no `BETTER_AUTH_SECRET` runs guest-only, and in that mode
the feature is **absent end to end**: there is no API Tokens category to open
and no way to mint one:

- **Frontend**: the Settings API Tokens category (and the AI Tools link row to
  it) renders only when sign-in is on (`authEnabled` from `/api/capabilities`),
  the same answer that hides the teams and sign-in sections of the sidebar, so
  when sign-in is off the category simply isn't in the list.
- **Backend**: the `/api/tokens` routes require a verified session, and with
  no `BETTER_AUTH_SECRET` the worker verifies no session token at all
  (`getAccountSession` in [`auth/session-token.ts`](../../../apps/api/src/auth/session-token.ts)
  returns null), so the routes reject every caller. Belt and suspenders: even
  if the UI were somehow reached, token creation or use is impossible without
  sign-in.

So enabling tokens is opt-in with sign-in, and disabling sign-in removes them
cleanly: no orphaned page, no half-working endpoint. This takes nothing away
from a guest-only self-host, because the whole canvas and guest model stays fully
available without an account ([Auth + guest access](../014-identity/auth-and-guest-access.md)). No
SaaS dependency: sign-in runs inside the api worker.

<!-- legacy-names -->

### 3.8 Deprecated diagram routes

The container was called a diagram before it became a document ([Document](../006-document/document.md)). The public routes moved from `/api/diagrams…` to `/api/documents…`; the old paths stay served until **30 April 2027** so scripts written against them keep working (`apps/api/src/legacy-documents-alias.ts`):

- A request to `/api/diagrams…` is moved to the same path under `/api/documents…` before anything else runs, so authentication, the guest signature gate and rate limits apply to it exactly as to the current route.
- The request body's keys `diagram`, `diagrams`, `diagramId`, `diagramName`, `diagramTeamId` and `diagramOwnerId` are renamed to their `document` forms; the response's keys are renamed back, at any depth. Values are never touched.
- Element links cross in both directions: an old `{ kind: 'diagram', diagramId }` link in a request is
  upgraded before the keys are renamed (`upgradeLegacyLinks`), and a response hands back the old
  form (`downgradeLinks`), so neither side ever sees a half-renamed link.
- An old client's `X-Diagram-Conversion` header travels on as `X-Document-Conversion`, and the
  `document_trashed` error code goes back as `diagram_trashed`.
- A body declared over the 8 MiB cap is refused with 413 before it is read, and the rewritten request
  carries its own `Content-Length`, so the size gate behind the alias still applies.
- Every aliased response carries `Deprecation: true`, `Sunset: Fri, 30 Apr 2027 00:00:00 GMT` and `Link: </api/documents>; rel="successor-version"`, and each call logs `[legacy-documents-alias] <method> <path>`, so the alias's remaining traffic is visible before it is removed.
- A WebSocket upgrade on the old path passes through unchanged.

Outside `/api/diagrams…` the paths never changed, so nothing marks a request as coming from an old
client. Those routes accept the old **request** forms until the sunset (`apps/api/src/legacy-request-forms.ts`):
the timeline's `scope=diagram:<id>`, and a `diagramId` in the team notification bodies. Their
**responses** use the new names only (`document` in `/share/{code}` and `/trash/{id}/restore`, the
`document_*` timeline types): repeating a whole document under two keys would double the largest
payloads.

After the sunset the alias module and this section go; `/api/diagrams…` then answers 404 like any unknown route.
<!-- /legacy-names -->

## 4. `X-Owner-Id` trust change

The bare header must stop being a usable credential — both for external callers
and to close the [§2](#2-why-the-api-wasnt-safe-to-expose-as-is-history)
escalation. Two options were weighed:

- **(a) First-party origin gate — rejected as the sole fix.** Accept
  `X-Owner-Id` only on same-origin requests via the `Origin` / `Sec-Fetch-Site`
  signals (as telemetry does, `origin-check.ts`). This does **not** stop the
  attack: a non-browser client sets the `Origin` header freely, so a `curl`
  caller forges `Origin: https://docs.nu` and passes the gate. Origin
  is hygiene, not an authorization boundary.
- **(b) Require an HMAC proof on the header — chosen.** Extend the guest-id
  HMAC (`auth/owner-signature.ts`, then also carried on the WS upgrade as
  `?g=`, since replaced by the room ticket) to REST: an `X-Owner-Id` request must also carry a valid `X-Owner-Sig` for that
  id, verified with the guest signing key (HKDF of `BETTER_AUTH_SECRET`,
  `apps/api/src/auth/guest-key.ts`). The legitimate guest holds its
  signature (minted at `POST /api/guest-id`); a collaborator who merely
  _harvested_ an id (a guest UUID, or an account id) has no valid signature, so
  the spoof is rejected. Signed-in users send their session token (a real
  credential) and never the header.

**Explicit guarantee for signed-up users.** Before this work `resolveOwner()`
(`apps/api/src/index.ts`) was `clerkUserId ?? X-Owner-Id`, with no check binding
the credential _type_ to the owner id, so a caller with no Bearer and
`X-Owner-Id: <an account id>` was accepted AS that account (verified at the time:
the sub leaked via presence / the change-log, and nothing rejected it). After (b), an
account's documents are reachable **only via a verified Bearer token**: an
`X-Owner-Id` carrying an account id has no guest signature (one is never minted
for an account id), and its shape is refused outright (§4.1). The post-fix invariant is therefore "once
signed up, your documents require your Bearer token; the header can't reach
them" — which is the property to assert in tests.

(b) is the heavier change — every guest write now signs — but it's the one that
actually closes the harvested-id escalation, and the live app already obtains
its signature, so wiring it onto REST requests is incremental. API tokens
([§3](#3-design-api-tokens)) are a parallel server-verifiable credential for
external callers.

**Compatibility: one rule, no grace window.** The signature is required
wherever the host has a guest signing key, which is wherever sign-in is on
(`guestSignatureEnforced`, `apps/api/src/auth/guest-rest.ts`). A guest-only
host has no key: it signs nothing and requires nothing, so it opts out of the
guard entirely. An unsigned guest id can't be retroactively secured (there is
no proof bound to it, so the server cannot tell its real owner from someone who
harvested it), so none is upgraded: an unsigned id from before sign-in was
turned on is refused on owner-scoped routes and never moves into an account
([Auth + guest access](../014-identity/auth-and-guest-access.md) "Signed guest ids"). Its rows are
never deleted for it; they stay under that id. The guest's browser starts
afresh with a signed id from `POST /api/guest-id`.

The key outlasts a rotation of the sign-in secret: it derives from the oldest
usable secret (`BETTER_AUTH_SECRET`, which better-auth keeps as its legacy
secret once `BETTER_AUTH_SECRETS` takes over, else the lowest version there),
never the current one, so rotating does not re-key every guest. Removing the
secret the key derives from does.

### 4.1 An account id in `X-Owner-Id` is refused unconditionally

The "explicit guarantee for signed-up users" above is the most valuable half of
§4, and it needs no signing key at all, so it holds on a guest-only host too.

An account id presented as `X-Owner-Id` has no legitimate story. No client has
ever sent one:

- The guest credential is always a server-minted `crypto.randomUUID()`
  (`POST /api/guest-id`), and `apps/live/lib/local-identity.ts` only ever writes
  a UUID into that header.
- A signed-in caller sends `Authorization` **instead** — the live app's
  `lib/api/core.ts` sends one or the other, never both.

So an `acct_…` value in that header is only ever a replay of an account id
someone harvested, and account ids are harvestable by design: `GET /api/teams/<id>`
lists `members[].userId` to every member of the team, invitees included.

The worker therefore refuses the **shape** outright, on every owner-scoped
segment, before the signature gate and independent of it (`isAccountIdShape`,
`packages/api-schema/src/request-auth.ts`, applied in `apps/api/src/index.ts`;
`401 account_id_not_a_guest_credential`). Nothing legitimate is grandfathered
because nothing legitimate ever had this shape, so there is no window to bound
and nothing for an operator to arm.

The realtime room's upgrade refuses the same shape on its owner leg (`?o=`, `routes/document-room-routes.ts`):
a signed-in owner of a personal document joins through the one-time room ticket, as a team owner does, and an
account id presented as `?o=` admits nobody. Wherever guest ids are signed, a guest owner id on `?o=`
needs its signature on `?os=` (the same value REST carries as `X-Owner-Sig`); without it the leg admits nobody.

`GET /api/share/<code>` also refuses an account id as `X-Owner-Id`, because its resolver compares that header with
the document's owner. It never returns the document's primary `shareCode`, to anyone: the visitor already holds the
code they arrived with. An empty `X-Owner-Id` is no identity at all, never a shared owner.

This matters most for **personal** documents, whose ownership legitimately
resolves through the hybrid header path — that path is safe precisely because a
personal owner id is an unguessable UUID, which an account id is not. The
**team**-document half of the same escalation is closed structurally instead, by
`ownsDocument` ([Team shared documents §Access](../013-workspace/team-shared-documents.md)), so it holds
whatever a deployment has configured.

The signature gate keeps its own job: proving possession of a **guest** id.

## 5. Input validation (prerequisite — shipped)

Opening the API magnifies the cost of weak input handling, so the validation
hardening landed first:

- **Structural schema validation** — `isValidElement` / `isValidTab`
  (`packages/document/src/validate.ts`) vet the element/tab discriminant,
  required fields, endpoints, array bounds + unique ids. The document routes run
  incoming tabs (create-seed + tab PUT) through `isValidTab` and reject
  malformed trees with `400`.
- **Size caps** — a global Content-Length body cap, per-tab byte cap, and
  name / theme-definition / participant / share-password caps
  (`apps/api/src/limits.ts`); a per-frame cap in the realtime room. Document
  and tab names are shortened to the 60-character name cap rather than
  rejected (`apps/api/src/names.ts`, [Tab and document name length](../006-document/name-length.md)).
- **Already solid** (pre-existing): D1 is fully parameterized; sign-in token
  verification; share-link expiry + constant-time password compare + per-IP
  brute-force limiter; WS-upgrade auth; realtime role re-stamping + op-rate cap.

## 6. Rollout

1. ✅ Input hardening (done).
2. ✅ **The `X-Owner-Id` HMAC requirement ([§4](#4-x-owner-id-trust-change)).**
   Enforced wherever sign-in is on, with no grace window and no operator switch:
   the key derives from `BETTER_AUTH_SECRET`, and every e2e stack signs in, so a
   regression fails the suite. History: it first shipped behind a cutoff
   (`GUEST_SIG_ENFORCE_AFTER`, with `GUEST_ID_HMAC_SECRET` as its own secret) and
   a legacy upgrade for ids older than `GUEST_SIGNING_LIVE_AT` (migrate's second
   flow). It was armed in production on 2026-10-06 and un-armed the same day:
   `/new` minted a local unsigned id, so a first-time visitor arriving there from
   the landing page was refused (`401 signature_required`) and could not create
   a document, against the rule that the canvas always works without signing
   in. Every entry path now resolves a signed id before its first owner-scoped
   call ([Auth and guest access](../014-identity/auth-and-guest-access.md) "Signed
   guest ids"). Moving sign-in to better-auth replaced the cutoff, the separate
   secret and the legacy upgrade with the one rule of §4.
   Pulled to the FRONT: it closed the cross-object escalation in
   [§2](#2-why-the-api-wasnt-safe-to-expose-as-is-history) and
   is independent of the token work, so it ships first (with the legacy-guest
   grace). **Stop emitting the raw owner id where a collaborator can read it**
   (do this, not just "consider" — shrinking the attack surface is worth it
   even though §4 already neutralises a leaked id, because people WILL probe
   for it):
   - Redact `participantId` in the change-log read for non-owners (the static
     harvest; moot since the change log was removed on 2026-10-03), the same way comment authors and the document `ownerId` already
     are.
   - Give each realtime session a **room-scoped ephemeral presence id**
     (random per connection) for the broadcast presence / cursor frames,
     decoupled from the real owner id. Cursor identity + dedup within the room
     use the ephemeral id; the server keeps the real→ephemeral mapping
     internally for its role/identity checks but never broadcasts the owner id.
     This removes the last surface that exposed it.

     One thing the ephemeral id cannot do, learned the hard way: **join a peer
     to something saved in the document.** It changes on every socket, so any
     feature that records an answer per person and then matches it back to the
     roster needs a second, stable id. That is `ParticipantPresence.key`, the
     collab key — see [Per-participant responses](../012-collaboration/participant-responses.md), which also
     explains why the owner id can't be it and why leaving the key claimable
     costs nothing.
3. ✅ `api_tokens` table + migration (`expires_at` fixed to +6 months) + token
   mint/verify (`auth/`), session-gated `/api/tokens` routes (the team-route
   gate, [Teams](../013-workspace/teams.md)).
4. ✅ The **Settings API Tokens category** (`SettingsTokensRow`) — the management
   UI ([§3.6](#36-management--the-settings-dialogs-api-tokens-category)); it
   replaced the original Explorer "API tokens" page,
   rendered only when sign-in is on, so it's absent on a guest-only self-host
   ([§3.7](#37-self-hosting)).
5. ✅ Wire token resolution into `resolveOwner`; enforce the read-only flag
   ([§3.4](#34-access--full-read--write-with-an-optional-read-only-flag)).
6. ✅ **Docs + help, shipped WITH the feature** (help articles describe live
   features and must be registered — see the help-centre rule in `AGENTS.md`,
   so this copy lands when the feature does, not before):
   - A new help article (e.g. `account-and-data/api-tokens`) covering what
     tokens are, creating/revoking them **from the Explorer**, the **6-month
     expiry + manual rotation**, and the **signed-in-only** limitation —
     registered in `apps/help/lib/articles.ts`.
   - Add API tokens to the "what signing in unlocks" list in the
     `account-and-data/signing-in` article (next to teams + cross-device sync).
   - `docs/` updates: note the new `/api/tokens` surface + its account
     requirement in `docs/development/architecture.md`, and the sign-in-gated nature in
     `docs/operations/self-hosting.md` (tokens need sign-in, like teams).
   - ✅ Public API reference for the existing routes. Two layers, both
     shipped: the machine-readable `GET /api/openapi.json`
     ([API documentation (OpenAPI)](api-documentation.md)), and a human-facing **Developers**
     category in the help centre ([Help app](../018-help/help-app.md)) whose API
     reference links out to it. The `account-and-data/api-tokens` article
     cross-links the reference as the next step after minting a token.

## 7. Out of scope (for now)

Finer-grained scopes — per-document / per-folder grants, per-verb permissions —
plus webhooks and any billing or quota tiers (the product has no paid tier —
[Open source + distribution](../002-project-scope/open-source-and-business-model.md)). (The one scope that DID land is
the **read-only** flag, [§3.4](#34-access--full-read--write-with-an-optional-read-only-flag);
OAuth / third-party app authorization landed in [MCP server](mcp-server.md).)
Every full token inherits the owner's read+write access; finer grants come
later if demand appears.
