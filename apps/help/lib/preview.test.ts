import { describe, expect, it } from 'vitest';
import { PREVIEW_APPS, previewConfig, previewNames, prNumber } from '../../../scripts/preview.mjs';

// scripts/preview.mjs derives a pull request's preview deployment from the production wrangler configs
// (docs/specs/016-platform/preview-deployments.md). It lives here with the other repo-wide guards because
// scripts/ belongs to no workspace.

const names = previewNames(12, 'webber');

describe('previewNames', () => {
  it('names every resource after the pull request', () => {
    expect(names).toEqual({
      prefix: 'docs-nu-pr-12',
      d1: 'docs-nu-pr-12',
      bucket: 'docs-nu-pr-12-images',
      origin: 'https://docs-nu-pr-12-router.webber.workers.dev',
    });
  });
});

describe('prNumber', () => {
  it('accepts a positive whole number', () => {
    expect(prNumber('12')).toBe(12);
  });

  it('refuses anything that is not one', () => {
    for (const bad of [undefined, '', '0', '-1', '1.5', '12a', '../12']) {
      expect(() => prNumber(bad)).toThrow(/pull request number/);
    }
  });
});

describe('PREVIEW_APPS', () => {
  it('deploys the api first and the router, which binds the rest, last', () => {
    expect(PREVIEW_APPS[0]).toBe('api');
    expect(PREVIEW_APPS.at(-1)).toBe('router');
    expect([...PREVIEW_APPS].sort()).toEqual(
      ['api', 'community', 'help', 'live', 'marketing', 'router', 'telemetry'].sort(),
    );
  });
});

describe('previewConfig', () => {
  const opts = { app: 'api', names, d1Id: 'preview-d1-id' };

  it('renames the worker and serves it on workers.dev only for the router', () => {
    expect(previewConfig({ name: 'docs-nu-api' }, opts)).toMatchObject({
      name: 'docs-nu-pr-12-api',
      workers_dev: false,
      preview_urls: false,
    });
    expect(previewConfig({ name: 'docs-nu-router' }, { ...opts, app: 'router' })).toMatchObject({
      name: 'docs-nu-pr-12-router',
      workers_dev: true,
    });
  });

  it('drops the production routes and every named environment', () => {
    const config = previewConfig(
      {
        name: 'docs-nu-router',
        routes: [{ pattern: 'docs.nu', custom_domain: true }],
        env: { local: { vars: { DEPLOY_ENV: 'local' } } },
      },
      { ...opts, app: 'router' },
    );
    expect(config.routes).toBeUndefined();
    expect(config.env).toBeUndefined();
  });

  it("binds the preview's own workers, never production's", () => {
    const config = previewConfig(
      {
        name: 'docs-nu-router',
        services: [
          { binding: 'API', service: 'docs-nu-api' },
          { binding: 'LIVE', service: 'docs-nu-live' },
        ],
      },
      { ...opts, app: 'router' },
    );
    expect(config.services).toEqual([
      { binding: 'API', service: 'docs-nu-pr-12-api' },
      { binding: 'LIVE', service: 'docs-nu-pr-12-live' },
    ]);
  });

  it('refuses a service binding outside docs.nu', () => {
    expect(() =>
      previewConfig(
        { name: 'docs-nu-live', services: [{ binding: 'API', service: 'livediagram-api' }] },
        { ...opts, app: 'live' },
      ),
    ).toThrow(/livediagram-api/);
  });

  it("points the database and the bucket at the preview's own", () => {
    const config = previewConfig(
      {
        name: 'docs-nu-api',
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'docs-nu',
            database_id: 'prod-id',
            migrations_dir: 'migrations',
          },
        ],
        r2_buckets: [{ binding: 'IMAGES', bucket_name: 'docs-nu-images' }],
      },
      opts,
    );
    expect(config.d1_databases).toEqual([
      {
        binding: 'DB',
        database_name: 'docs-nu-pr-12',
        database_id: 'preview-d1-id',
        migrations_dir: 'migrations',
      },
    ]);
    expect(config.r2_buckets).toEqual([{ binding: 'IMAGES', bucket_name: 'docs-nu-pr-12-images' }]);
  });

  it('refuses a database without the preview database id', () => {
    expect(() =>
      previewConfig(
        { name: 'docs-nu-api', d1_databases: [{ binding: 'DB', database_name: 'docs-nu' }] },
        { ...opts, d1Id: '' },
      ),
    ).toThrow(/database id/);
  });

  it('moves every rate limiter from 70xx to the shared preview range 71xx', () => {
    const config = previewConfig(
      {
        name: 'docs-nu-api',
        unsafe: {
          bindings: [
            { name: 'WRITE_RATE_LIMITER', type: 'ratelimit', namespace_id: '7001' },
            { name: 'FORM_RATE_LIMITER', type: 'ratelimit', namespace_id: '7011' },
          ],
        },
      },
      opts,
    );
    const { bindings } = config.unsafe as { bindings: { namespace_id: string }[] };
    expect(bindings.map((b) => b.namespace_id)).toEqual(['7101', '7111']);
  });

  it("refuses a rate limiter outside docs.nu's range, which could share another worker's counter", () => {
    expect(() =>
      previewConfig(
        {
          name: 'docs-nu-api',
          unsafe: { bindings: [{ name: 'X', type: 'ratelimit', namespace_id: '1001' }] },
        },
        opts,
      ),
    ).toThrow(/1001/);
  });

  it('refuses a KV namespace: previews do not run the MCP worker', () => {
    expect(() =>
      previewConfig(
        { name: 'docs-nu-mcp', kv_namespaces: [{ binding: 'OAUTH_KV', id: 'x' }] },
        { ...opts, app: 'mcp' },
      ),
    ).toThrow(/KV/);
  });

  it("locks the api's AI origin and email links to the preview's own origin", () => {
    const config = previewConfig(
      { name: 'docs-nu-api', vars: { AI_ALLOWED_ORIGINS: 'https://docs.nu', OAUTH_ISSUER: '' } },
      opts,
    );
    expect(config.vars).toEqual({
      AI_ALLOWED_ORIGINS: names.origin,
      APP_BASE_URL: names.origin,
      OAUTH_ISSUER: '',
    });
  });

  it('marks the router as a preview, so every response is noindex', () => {
    const config = previewConfig({ name: 'docs-nu-router' }, { ...opts, app: 'router' });
    expect(config.vars).toEqual({ DEPLOY_ENV: 'preview' });
  });

  it('keeps everything else as production has it', () => {
    const source = {
      name: 'docs-nu-live',
      main: 'src/worker.ts',
      compatibility_date: '2026-05-29',
      assets: { directory: './out', binding: 'ASSETS' },
    };
    expect(previewConfig(source, { ...opts, app: 'live' })).toMatchObject({
      main: 'src/worker.ts',
      compatibility_date: '2026-05-29',
      assets: { directory: './out', binding: 'ASSETS' },
    });
  });

  it('leaves the production config untouched', () => {
    const source = { name: 'docs-nu-router', routes: [{ pattern: 'docs.nu' }] };
    previewConfig(source, { ...opts, app: 'router' });
    expect(source).toEqual({ name: 'docs-nu-router', routes: [{ pattern: 'docs.nu' }] });
  });
});
