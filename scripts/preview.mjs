// Pull request previews (docs/specs/016-platform/preview-deployments.md): one complete, isolated copy of
// docs.nu per pull request, on workers.dev, derived from the production wrangler configs.
//
//   node scripts/preview.mjs deploy <pr>     create or update the preview; prints its origin
//   node scripts/preview.mjs teardown <pr>   delete every resource the preview owns
//
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. `deploy` expects `pnpm build` to have run; its
// NEXT_PUBLIC_BUILD_ID, when set, becomes the api's BUILD_ID. The pure helpers are exported for
// apps/help/lib/preview.test.ts.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_PREFIX = 'docs-nu-';
const PREVIEW_CONFIG = 'wrangler.preview.json';
const LOCATION = 'weur';

/** Deploy order: the api first (two apps bind it), the router, which binds the other six, last. */
export const PREVIEW_APPS = [
  'api',
  'marketing',
  'telemetry',
  'help',
  'live',
  'community',
  'router',
];

/** @param {number} pr @param {string} subdomain the account's workers.dev subdomain */
export function previewNames(pr, subdomain) {
  const prefix = `docs-nu-pr-${pr}`;
  return {
    prefix,
    d1: prefix,
    bucket: `${prefix}-images`,
    origin: `https://${prefix}-router.${subdomain}.workers.dev`,
  };
}

/** @param {string | undefined} arg */
export function prNumber(arg) {
  if (!arg || !/^[1-9]\d*$/.test(arg))
    throw new Error(`preview: not a pull request number: ${arg}`);
  return Number(arg);
}

/** `docs-nu-<app>` → `docs-nu-pr-<n>-<app>`; anything else is not docs.nu's and is refused. */
function previewWorker(name, prefix) {
  if (!name.startsWith(PRODUCTION_PREFIX)) {
    throw new Error(`preview: ${name} is not a docs.nu worker`);
  }
  return `${prefix}-${name.slice(PRODUCTION_PREFIX.length)}`;
}

/** Rate limiter ids are account-wide: production holds 7001-7012, every preview shares 7101-7112. */
function previewLimiter(binding) {
  if (binding.type !== 'ratelimit') return binding;
  const id = String(binding.namespace_id);
  if (!/^70\d\d$/.test(id)) {
    throw new Error(
      `preview: rate limiter ${binding.name} uses ${id}, outside docs.nu's 7001-7099`,
    );
  }
  return { ...binding, namespace_id: `71${id.slice(2)}` };
}

/**
 * A production wrangler config, as one pull request's preview deploys it.
 * @param {Record<string, any>} config the parsed top-level wrangler.toml
 * @param {{ app: string, names: ReturnType<typeof previewNames>, d1Id: string }} options
 */
export function previewConfig(config, { app, names, d1Id }) {
  const { env: _env, routes: _routes, ...rest } = structuredClone(config);
  if (rest.kv_namespaces) throw new Error(`preview: ${app} binds KV; previews do not run it`);
  const out = {
    ...rest,
    name: previewWorker(rest.name, names.prefix),
    workers_dev: app === 'router',
    preview_urls: false,
  };
  if (rest.services) {
    out.services = rest.services.map((s) => ({
      ...s,
      service: previewWorker(s.service, names.prefix),
    }));
  }
  if (rest.d1_databases) {
    if (!d1Id) throw new Error(`preview: ${app} binds D1 but no preview database id was given`);
    out.d1_databases = rest.d1_databases.map((d) => ({
      ...d,
      database_name: names.d1,
      database_id: d1Id,
    }));
  }
  if (rest.r2_buckets) {
    out.r2_buckets = rest.r2_buckets.map((b) => ({ ...b, bucket_name: names.bucket }));
  }
  if (rest.unsafe?.bindings) {
    out.unsafe = { ...rest.unsafe, bindings: rest.unsafe.bindings.map(previewLimiter) };
  }
  if (app === 'api') {
    out.vars = { ...rest.vars, AI_ALLOWED_ORIGINS: names.origin, APP_BASE_URL: names.origin };
  }
  if (app === 'router') out.vars = { ...rest.vars, DEPLOY_ENV: 'preview' };
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Side effects: the Cloudflare API and wrangler.

const log = (message) => console.log(`[preview] ${message}`);

function account() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !id) throw new Error('preview: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID');
  return { token, id };
}

/** One Cloudflare API call; `allow` lists the HTTP statuses that are an answer rather than a failure. */
async function cf(method, route, { body, allow = [] } = {}) {
  const { token, id } = account();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (allow.includes(res.status)) return { status: res.status, json: null };
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const errors = json?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') ?? res.statusText;
    throw new Error(`preview: ${method} ${route} answered ${res.status}: ${errors}`);
  }
  return { status: res.status, json };
}

async function workersSubdomain() {
  const { json } = await cf('GET', '/workers/subdomain');
  return json.result.subdomain;
}

async function findDatabase(name) {
  const { json } = await cf('GET', `/d1/database?name=${encodeURIComponent(name)}`);
  return json.result.find((db) => db.name === name)?.uuid ?? null;
}

async function ensureDatabase(name) {
  const existing = await findDatabase(name);
  if (existing) return existing;
  const { json } = await cf('POST', '/d1/database', {
    body: { name, primary_location_hint: LOCATION },
  });
  log(`created D1 ${name}`);
  return json.result.uuid;
}

async function ensureBucket(name) {
  const { status } = await cf('GET', `/r2/buckets/${name}`, { allow: [404] });
  if (status !== 404) return;
  await cf('POST', '/r2/buckets', { body: { name, locationHint: LOCATION } });
  log(`created R2 ${name}`);
}

/** Runs a command with its output streamed live, and kept for the caller to read. */
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

// A brand-new worker is briefly invisible to wrangler's workers.dev step, which then fails with
// 10007 even though the upload succeeded (docs/operations/docs-nu.md). Every preview's first deploy
// creates seven new workers, so only that answer is retried; any other failure stops the deploy.
const NEW_WORKER_RACE = /This Worker does not exist on your account\. \[code: 10007\]/;
const RACE_ATTEMPTS = 6;
const RACE_PAUSE_MS = 30_000;

async function wranglerDeploy(app, extraArgs) {
  const cwd = path.join(ROOT, 'apps', app);
  for (let attempt = 1; attempt <= RACE_ATTEMPTS; attempt++) {
    const { ok, output } = await run(
      'pnpm',
      ['exec', 'wrangler', 'deploy', '--config', PREVIEW_CONFIG, ...extraArgs],
      cwd,
    );
    if (ok) return;
    if (!NEW_WORKER_RACE.test(output) || attempt === RACE_ATTEMPTS) {
      throw new Error(`preview: deploying ${app} failed (attempt ${attempt})`);
    }
    log(`${app}: new worker not visible yet (attempt ${attempt}), retrying in 30 s`);
    await new Promise((resolve) => setTimeout(resolve, RACE_PAUSE_MS));
  }
}

async function deploy(pr) {
  const names = previewNames(pr, await workersSubdomain());
  const d1Id = await ensureDatabase(names.d1);
  await ensureBucket(names.bucket);
  for (const app of PREVIEW_APPS) {
    const source = parse(readFileSync(path.join(ROOT, 'apps', app, 'wrangler.toml'), 'utf8'));
    const config = previewConfig(source, { app, names, d1Id });
    writeFileSync(
      path.join(ROOT, 'apps', app, PREVIEW_CONFIG),
      `${JSON.stringify(config, null, 2)}\n`,
    );
  }
  log(`applying D1 migrations to ${names.d1}`);
  const migrated = await run(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', PREVIEW_CONFIG],
    path.join(ROOT, 'apps', 'api'),
  );
  if (!migrated.ok) throw new Error('preview: D1 migrations failed');
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  for (const app of PREVIEW_APPS) {
    log(`deploying ${app}`);
    await wranglerDeploy(app, app === 'api' && buildId ? ['--var', `BUILD_ID:${buildId}`] : []);
  }
  log(`live: ${names.origin}`);
  console.log(`PREVIEW_URL=${names.origin}`);
}

async function emptyBucket(name) {
  let cursor = '';
  let removed = 0;
  do {
    const query = `per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const { json } = await cf('GET', `/r2/buckets/${name}/objects?${query}`);
    for (const object of json.result) {
      await cf('DELETE', `/r2/buckets/${name}/objects/${encodeURIComponent(object.key)}`);
      removed++;
    }
    cursor = json.result_info?.is_truncated ? json.result_info.cursor : '';
  } while (cursor);
  return removed;
}

async function teardown(pr) {
  const names = previewNames(pr, await workersSubdomain());
  // Reverse order: nothing still binds a worker when it goes.
  for (const app of [...PREVIEW_APPS].reverse()) {
    const worker = `${names.prefix}-${app}`;
    const { status } = await cf('DELETE', `/workers/scripts/${worker}?force=true`, {
      allow: [404],
    });
    log(status === 404 ? `${worker} already gone` : `deleted worker ${worker}`);
  }
  const d1Id = await findDatabase(names.d1);
  if (d1Id) {
    await cf('DELETE', `/d1/database/${d1Id}`);
    log(`deleted D1 ${names.d1}`);
  } else log(`D1 ${names.d1} already gone`);
  const { status } = await cf('GET', `/r2/buckets/${names.bucket}`, { allow: [404] });
  if (status === 404) log(`R2 ${names.bucket} already gone`);
  else {
    const removed = await emptyBucket(names.bucket);
    await cf('DELETE', `/r2/buckets/${names.bucket}`);
    log(`deleted R2 ${names.bucket} (${removed} objects)`);
  }
}

async function main([command, arg]) {
  switch (command) {
    case 'deploy':
      return deploy(prNumber(arg));
    case 'teardown':
      return teardown(prNumber(arg));
    default:
      throw new Error('usage: node scripts/preview.mjs deploy|teardown <pr>');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
