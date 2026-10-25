# docs.nu deployment

LiveDoc runs at [docs.nu](https://docs.nu) on its own Cloudflare account. The top-level `wrangler.toml` of every app is docs.nu's production; nothing points at livediagram's infrastructure ([docs.nu vision, PR #1](https://github.com/webbertakken/livedoc/pull/1)). The general steps are in [Self-hosting](./self-hosting.md); this page records only what is specific to docs.nu.

## Shape

- Workers: `docs-nu-api`, `docs-nu-marketing`, `docs-nu-live`, `docs-nu-telemetry`, `docs-nu-help`, `docs-nu-community` and `docs-nu-router`. `docs-nu-mcp` is configured but not deployed: its consent page needs a signed-in account, and docs.nu does not run sign-in yet.
- Resources: D1 `docs-nu` and R2 `docs-nu-images` (western Europe), and the KV namespace `docs-nu-mcp-oauth` for the MCP worker.
- Rate limiters use namespace ids `7001`-`7012`: the ids are account-wide, and other workers on the account hold `1001` onwards.
- Hostnames: `docs.nu` is canonical. `www.docs.nu` is attached to the router too, and a zone redirect rule (301, path and query kept) sends it to the apex. The zone has Always Use HTTPS on. Both zone settings live in the dashboard, not in this repo.
- Hosted profile (`apps/api/hosted-vars.json`, applied only in `webbertakken/livedoc`): telemetry on, image gallery caps of 100 images and 100 MB per owner, `APP_BASE_URL` `https://docs.nu`. No Google client id yet, so the Drive mirror is off.
- Guest-only: no `BETTER_AUTH_SECRET`, so no sign-in, teams, API tokens or MCP. AI and email are off until their keys are set.
- No staging environment: every pull request gets its own preview at `https://<branch>.preview.docs.nu` ([Preview deployments](../specs/016-platform/preview-deployments.md)).

## Deploy

From a clean checkout of the commit to ship:

```sh
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... scripts/deploy-docs-nu.sh
```

The script mirrors `deploy-reusable.yml`: it builds with the hosted profile's build-time twins, applies D1 migrations, deploys the api with the hosted vars and verifies them on the live worker, then deploys the five downstream apps and the router. `pnpm deploy:check` dry-runs the configs that carry bindings.

The first deploy of a brand-new worker can fail with `This Worker does not exist on your account. [code: 10007]`: wrangler reads the worker's workers.dev state a moment after creating it, before Cloudflare shows it. Run the script again after a minute or two; a worker that exists never hits this.

The token needs, on the account: Workers Scripts, D1, Workers R2 Storage and Workers KV Storage edit, plus Account Settings read. On the `docs.nu` zone: DNS and Workers Routes edit, for the custom domains.

## npm

LiveDoc publishes to npm under its own scope, `@livedoc`, an npm organisation owned by Webber's npm account. Its CLI is `@livedoc/cli`, the command `livedoc`. It never publishes under livediagram's names: upstream owns `@livediagram/cli`.

- Why `@livedoc`: the `livedocs` scope belongs to an unrelated npm user account, and the unscoped `livedocs` and `livedoc` packages belong to other people.
- Publishing goes through npm trusted publishing (OIDC) from `.github/workflows/cli-publish.yml`, with provenance. No npm token is stored anywhere.
- The workflow runs on every push to `main` that changes `apps/cli/package.json`, and by hand. It publishes the version in that file unless npm already has it, so a version bump is a release.
- The CLI's default host is `https://docs.nu`. docs.nu runs without sign-in, so the CLI's commands that reach the api stop with `https://docs.nu has no sign-in, so the CLI cannot act there` (exit 4); its local commands (`guide`, `skill install`, `graph lint`, offline views of pulled files, `--help`) work.

### Trusted publisher rules

These come from npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers) and [staged publishing](https://docs.npmjs.com/staged-publishing) docs and `npm help trust`:

- A trusted publisher belongs to a package that already exists on npm. A name that has never been published has no settings page to add one to, and `npm trust` refuses it.
- A new trusted publisher must complete a successful publish within 2 days, or it expires and must be deleted and created again.
- Publishers created since 3 September 2026 allow only `npm stage publish` by default. `cli-publish.yml` runs `npm publish`, so **npm publish** must be ticked under allowed actions.
- The fields are case-sensitive and fixed once created; to change one, delete the publisher and add it again. Renaming `cli-publish.yml` or the repository breaks it.
- Trusted publishing needs npm 11.5 or later (the workflow updates npm itself) and GitHub-hosted runners, with `id-token: write` on the job.
- Provenance checks that the published `package.json`'s `repository.url` is this repository, `https://github.com/webbertakken/livedoc`; `apps/cli/scripts/build.mjs` writes it.

### Set up the package

1. Create the organisation: at [npmjs.com/org/create](https://www.npmjs.com/org/create), with two-factor authentication on the account, name it `livedoc` on the free plan (public packages only). [npmjs.com/org/livedoc](https://www.npmjs.com/org/livedoc) then shows it.
2. Create the package with a placeholder, by hand from Webber's machine (`npm login` first): `@livedoc/cli@0.0.0`. The CLI's real releases start above it.
3. On [npmjs.com/package/@livedoc/cli/access](https://www.npmjs.com/package/@livedoc/cli/access), under **Trusted publisher**, choose **GitHub Actions**: organization or user `webbertakken`, repository `livedoc`, workflow filename `cli-publish.yml`, environment name empty, allowed actions **npm publish**. From the command line, with npm 11.15 or later: `npm trust github @livedoc/cli --repo webbertakken/livedoc --file cli-publish.yml --allow-publish`.
4. Within 2 days, merge a version bump of `apps/cli/package.json` to `main`, or run **Actions > CLI publish > Run workflow**. Its first successful publish validates the publisher.
5. Then, on the same page, set **Publishing access** to **Require two-factor authentication and disallow tokens**.
