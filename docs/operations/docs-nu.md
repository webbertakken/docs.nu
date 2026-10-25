# docs.nu deployment

LiveDoc runs at [docs.nu](https://docs.nu) on its own Cloudflare account. The top-level `wrangler.toml` of every app is docs.nu's production; nothing points at livediagram's infrastructure ([docs.nu vision, PR #1](https://github.com/webbertakken/livedoc/pull/1)). The general steps are in [Self-hosting](./self-hosting.md); this page records only what is specific to docs.nu.

## Shape

- Workers: `docs-nu-api`, `docs-nu-marketing`, `docs-nu-live`, `docs-nu-telemetry`, `docs-nu-help`, `docs-nu-community` and `docs-nu-router`. `docs-nu-mcp` is configured but not deployed: it signs people in through Clerk, which docs.nu does not run yet.
- Resources: D1 `docs-nu` and R2 `docs-nu-images` (western Europe), and the KV namespace `docs-nu-mcp-oauth` for the MCP worker.
- Rate limiters use namespace ids `7001`-`7012`: the ids are account-wide, and other workers on the account hold `1001` onwards.
- Hostnames: `docs.nu` is canonical. `www.docs.nu` is attached to the router too, and a zone redirect rule (301, path and query kept) sends it to the apex. The zone has Always Use HTTPS on. Both zone settings live in the dashboard, not in this repo.
- Hosted profile (`apps/api/hosted-vars.json`, applied only in `webbertakken/livedoc`): telemetry on, image gallery caps of 100 images and 100 MB per owner, `APP_BASE_URL` `https://docs.nu`. No Google client id yet, so the Drive mirror is off.
- Guest-only: no Clerk, so no sign-in, teams, API tokens or MCP. AI and email are off until their keys are set.
- No staging environment: every pull request gets its own preview on `webber.workers.dev` ([Preview deployments](../specs/016-platform/preview-deployments.md)).

## Deploy

From a clean checkout of the commit to ship:

```sh
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... scripts/deploy-docs-nu.sh
```

The script mirrors `deploy-reusable.yml`: it builds with the hosted profile's build-time twins, applies D1 migrations, deploys the api with the hosted vars and verifies them on the live worker, then deploys the five downstream apps and the router. `pnpm deploy:check` dry-runs the configs that carry bindings.

The first deploy of a brand-new worker can fail with `This Worker does not exist on your account. [code: 10007]`: wrangler reads the worker's workers.dev state a moment after creating it, before Cloudflare shows it. Run the script again after a minute or two; a worker that exists never hits this.

The token needs, on the account: Workers Scripts, D1, Workers R2 Storage and Workers KV Storage edit, plus Account Settings read. On the `docs.nu` zone: DNS and Workers Routes edit, for the custom domains.
