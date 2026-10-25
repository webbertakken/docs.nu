# Preview deployments

Every pull request gets its own complete, isolated copy of the platform, on workers.dev, for as long as it is open. A change is _running_ somewhere before anyone decides to merge it, and a D1 migration runs against a real remote database before it reaches the one holding people's documents.

Production stays as it is: manual, `workflow_dispatch`-only ([Deployment](deployment.md)). There is no staging environment; a preview per pull request takes its place.

## A preview

|               | Production       | Preview of pull request `n`                           |
| ------------- | ---------------- | ----------------------------------------------------- |
| Address       | `docs.nu`        | `https://docs-nu-pr-<n>-router.<account>.workers.dev` |
| Trigger       | Manual           | Every push to the pull request                        |
| Workflow      | `deploy.yml`     | `preview.yml`                                         |
| Worker names  | `docs-nu-<app>`  | `docs-nu-pr-<n>-<app>`                                |
| D1            | `docs-nu`        | `docs-nu-pr-<n>`, migrated on every deploy            |
| R2            | `docs-nu-images` | `docs-nu-pr-<n>-images`                               |
| Rate limiters | `7001`-`7012`    | `7101`-`7112`, shared by every preview                |
| Indexable     | Yes              | **No**: `X-Robots-Tag: noindex, nofollow`             |
| Lifetime      | Permanent        | Deleted when the pull request closes                  |

The seven path-routed workers deploy (api, marketing, telemetry, help, live, community, router); the MCP worker does not. Only the router is on workers.dev; the other six are reached through its service bindings, as in production.

## Derived, never restated

A preview's configuration is generated from the production `wrangler.toml` of each app by `scripts/preview.mjs`, into a gitignored `wrangler.preview.json` beside it. Nothing about previews is written into the wrangler configs, so a binding added to production is in the next preview without anyone restating it.

The generator renames and repoints, and refuses what it cannot repoint safely:

- Worker names and service bindings move from `docs-nu-<app>` to `docs-nu-pr-<n>-<app>`. A service binding that is not a `docs-nu-` worker is refused: it would reach outside the preview.
- The D1 and R2 bindings point at the preview's own database and bucket.
- Rate limiters move from `70xx` to `71xx`. Their namespace ids are account-wide, so a preview never spends production's counters. An id outside `70xx` is refused.
- A KV binding is refused: only the MCP worker has one, and previews do not run it.
- Production's routes and every named environment are dropped. The router alone gets `workers_dev`.
- The api's `AI_ALLOWED_ORIGINS` and `APP_BASE_URL` become the preview's address; the router's `DEPLOY_ENV` becomes `preview`.

The hosted profile ([Deployment](deployment.md) "Hosted profile") is not applied: a preview runs as a fork would, telemetry off and uncapped.

## Lifecycle

- **Open, push or reopen**: build every app, create the D1 and R2 when missing, apply migrations, deploy the api first and the router last, then post or update one comment on the pull request with the address.
- **Close or merge**: delete the seven workers (router first, so nothing still binds a worker when it goes), the D1, and the R2 bucket after emptying it. The comment says so.
- One run per pull request at a time; a newer push or the close cancels an unfinished one.
- A brand-new worker is briefly invisible to wrangler's workers.dev step, which then fails with `10007` although the upload succeeded. Every first preview deploy creates seven, so the generator retries that one answer, and only that one, up to six times, 30 seconds apart.

## noindex, at the edge

A preview is public on purpose: no auth wall, so a change can be shared before it ships. The router stamps `X-Robots-Tag: noindex, nofollow` on every response when `DEPLOY_ENV` is `preview`, once, rather than as a build flag threaded through five static apps. A `101` WebSocket upgrade passes through untouched: a response carrying a socket cannot be rebuilt, and wrapping it would break realtime on previews alone.

## Pull requests from forks

Get no preview. Their runs have none of this repository's secrets, and a preview would deploy their code with its Cloudflare token.

## Secrets

`CF_API_TOKEN` and `CF_ACCOUNT_ID`, the same two production's deploy uses. The token needs, on the account: Workers Scripts, D1, Workers R2 Storage and Workers KV Storage edit, plus Account Settings read. Previews need no zone permission: workers.dev is the account's own.

## Configuration lives in the file

A plain var set only in the Cloudflare dashboard is invisible to code review, and the next `wrangler deploy` wipes it: deploy replaces a worker's plain vars with exactly the ones it declares. Every var is stated in `wrangler.toml`, or in the hosted profile for what only docs.nu runs with.
