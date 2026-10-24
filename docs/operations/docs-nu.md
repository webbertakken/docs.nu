# docs.nu deployment

This fork runs at [docs.nu](https://docs.nu) on its own Cloudflare account, as an extra wrangler environment beside upstream's production and staging. The general steps are in [Self-hosting](./self-hosting.md); this page records only what is specific to docs.nu.

## Shape

- Every app's `wrangler.toml` carries an `[env.docs-nu]` block; the top-level config and `[env.staging]` stay upstream's, so syncing from upstream rarely conflicts.
- Workers: `docs-nu-api`, `docs-nu-marketing`, `docs-nu-live`, `docs-nu-telemetry`, `docs-nu-help`, `docs-nu-community` and `docs-nu-router`. The MCP worker is not deployed.
- Resources: D1 `docs-nu` and R2 `docs-nu-images`, both in western Europe.
- Rate limiters use namespace ids `7001`-`7012`: the ids are account-wide, and other workers on the account hold `1001` onwards.
- Hostnames: `docs.nu` is canonical. `www.docs.nu` is attached to the router too, and a zone redirect rule (301, path and query kept) sends it to the apex. The zone has Always Use HTTPS on. Both zone settings live in the dashboard, not in this repo.
- Guest-only: no Clerk, so no sign-in, teams, API tokens or MCP. Telemetry, AI, email and the Drive mirror are off until their keys are set.

## Deploy

From a clean checkout of the commit to ship:

```sh
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... scripts/deploy-docs-nu.sh
```

The script builds, applies D1 migrations, deploys the api, the five downstream apps, then the router.

The first deploy of a brand-new worker can fail with `This Worker does not exist on your account. [code: 10007]`: wrangler reads the worker's workers.dev state a moment after creating it, before Cloudflare shows it. Run the script again after a minute or two; a worker that exists never hits this. Never run a bare `wrangler deploy` in this fork: without `--env docs-nu` it targets upstream's `livediagram-*` names.

The token needs, on the account: Workers Scripts, D1 and Workers R2 Storage edit, plus Account Settings read. On the `docs.nu` zone: DNS and Workers Routes edit, for the custom domains.
