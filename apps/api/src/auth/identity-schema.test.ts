import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pendingIdentitySql } from './identity-schema';

const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url).href);

// The schema check better-auth would run on every request runs here instead (src/auth/identity.ts). A failure
// means better-auth wants tables or columns no migration has: run `bun scripts/identity-schema.mts <name>`.
describe('identity schema', () => {
  it('is in step with better-auth', async () => {
    expect(await pendingIdentitySql(MIGRATIONS)).toBe('');
  });

  it('compiles the missing tables when a migration is absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'identity-schema-'));
    try {
      cpSync(MIGRATIONS, dir, { recursive: true, filter: (src) => !src.endsWith('_identity.sql') });
      expect(await pendingIdentitySql(dir)).toContain('create table "identity_users"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
