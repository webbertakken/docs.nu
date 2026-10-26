# docs.nu deployment

LiveDoc runs at [docs.nu](https://docs.nu) on its own Cloudflare account. The top-level `wrangler.toml` of every app is docs.nu's production; nothing points at livediagram's infrastructure ([docs.nu vision, PR #1](https://github.com/webbertakken/livedoc/pull/1)). The general steps are in [Self-hosting](./self-hosting.md); this page records only what is specific to docs.nu.

## Shape

- Workers: `docs-nu-api`, `docs-nu-marketing`, `docs-nu-live`, `docs-nu-telemetry`, `docs-nu-help`, `docs-nu-community` and `docs-nu-router`. `docs-nu-mcp` is configured but not deployed (the deploy's MCP job is opt-in), so `mcp.docs.nu` does not answer yet.
- Resources: D1 `docs-nu` and R2 `docs-nu-images` (western Europe), and the KV namespace `docs-nu-mcp-oauth` for the MCP worker.
- Rate limiters use namespace ids `7001`-`7014`: the ids are account-wide, and other workers on the account hold `1001` onwards.
- Hostnames: `docs.nu` is canonical. `www.docs.nu` is attached to the router too, and a zone redirect rule (301, path and query kept) sends it to the apex. The zone has Always Use HTTPS on. Both zone settings live in the dashboard, not in this repo.
- Hosted profile (`apps/api/hosted-vars.json`, applied only in `webbertakken/livedoc`): telemetry on, image gallery caps of 100 images and 100 MB per owner, `APP_BASE_URL` `https://docs.nu`. No Google client id yet, so the Drive mirror is off.
- Sign-in is on (`BETTER_AUTH_SECRET`, Google and email codes); its codes are sent as `LiveDoc <hello@docs.nu>`. AI is off until its key is set.
- No staging environment: every pull request gets its own preview at `https://<branch>.preview.docs.nu` ([Preview deployments](../specs/016-platform/preview-deployments.md)).

## Brand

docs.nu is LiveDoc's, and a guard keeps it so: `apps/help/lib/brand-name-guard.test.ts` fails on the old product name outside the pages about the [upstream project](../specs/002-project-scope/livediagram-upstream.md) and a few stored hash domains that must not change.

- Emails show the mark from `/email/livedoc-mark-64.png`, served by the marketing app. Every email ever sent points at that path, so it never moves.
- Documents are `.livedoc` files, `application/vnd.livedoc+json`; browser storage keys start `livedoc:`.
- The MCP registry listing (`server.json`, `io.github.webbertakken/livedoc`) is published by hand from **Actions > Publish MCP server to registry**, once `mcp.docs.nu` serves. Restore the workflow's push trigger then.

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
- The CLI's default host is `https://docs.nu`. Browser login (`livedoc auth login`) goes through the MCP worker's OAuth server, which docs.nu does not run yet; until it does, sign in with an API token made in the Settings dialog (`livedoc auth login --with-token`). Its local commands (`guide`, `skill install`, `graph lint`, offline views of pulled files, `--help`) need no sign-in.

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
