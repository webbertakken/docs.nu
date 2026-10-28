import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleFavourites } from './favourites';

// Route surface for per-user document stars (docs/specs/013-workspace/favourites.md), against the real schema. A star
// is owner-scoped, and a star on a document the person cannot reach answers exactly as a missing one, writing nothing,
// so it never tells a stranger that an id is real.

let db: SqliteD1;

type Who = { owner?: string | null; sessionAccountId?: string | null };

const call = (method: string, path: string, who: Who = {}) =>
  handleFavourites(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: who.owner === undefined ? 'owner-1' : who.owner,
      sessionAccountId: who.sessionAccountId ?? null,
    }),
  );

const stars = () =>
  db.sql
    .prepare('SELECT owner_id, document_id FROM favourites ORDER BY owner_id, document_id')
    .all()
    .map((r) => `${r['owner_id']}:${r['document_id']}`);

beforeEach(() => {
  db = sqliteD1();
  const doc = db.sql.prepare(
    `INSERT INTO documents (id, owner_id, team_id, name, shareable, saved_at, created_at, trashed_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
  );
  db.sql
    .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run('t1', 'T');
  db.sql
    .prepare(
      `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
       VALUES ('m1', 't1', 'acct-1', 'member', 'joined', 0, 0)`,
    )
    .run();
  doc.run('mine', 'owner-1', null, 'Mine', 0, null);
  doc.run('theirs', 'owner-2', null, 'Theirs', 0, null);
  doc.run('team-doc', 'acct-2', 't1', 'Team', 0, null);
  doc.run('shared', 'owner-2', null, 'Shared', 1, null);
  doc.run('binned', 'owner-1', null, 'Binned', 0, 1);
  db.sql.exec(`INSERT INTO share_links (code, document_id, role, created_at)
               VALUES ('code-1', 'shared', 'view', 0)`);
  db.sql.exec(`INSERT INTO shared_with (owner_id, document_id, role, share_code, last_seen)
               VALUES ('owner-1', 'shared', 'view', 'code-1', 0)`);
});

describe('handleFavourites', () => {
  it('400 when no owner resolves: a star has to belong to someone', async () => {
    const res = await call('GET', '/api/favourites', { owner: null });
    expect(res.status).toBe(400);
  });

  it('stars the person’s own document, and lists it for them alone', async () => {
    expect((await call('PUT', '/api/favourites/mine')).status).toBe(204);
    expect(stars()).toEqual(['owner-1:mine']);
    const res = await call('GET', '/api/favourites');
    expect(await res.json()).toEqual({ ids: ['mine'] });
    expect(await (await call('GET', '/api/favourites', { owner: 'owner-2' })).json()).toEqual({
      ids: [],
    });
  });

  it('stars a document shared with them through a live link', async () => {
    expect((await call('PUT', '/api/favourites/shared')).status).toBe(204);
    expect(stars()).toEqual(['owner-1:shared']);
  });

  it('stars a team document for a joined member, by their verified account', async () => {
    const member = { owner: 'acct-1', sessionAccountId: 'acct-1' };
    expect((await call('PUT', '/api/favourites/team-doc', member)).status).toBe(204);
    expect(stars()).toEqual(['acct-1:team-doc']);
  });

  it('answers a document out of reach as a missing one, writing nothing', async () => {
    for (const path of ['theirs', 'team-doc', 'gone', 'binned']) {
      const res = await call('PUT', `/api/favourites/${path}`);
      expect(res.status, path).toBe(404);
    }
    // A member's id in the unsigned guest header is no membership.
    expect((await call('PUT', '/api/favourites/team-doc', { owner: 'acct-1' })).status).toBe(404);
    expect(stars()).toEqual([]);
  });

  it('answers once its link is gone, as for any document out of reach', async () => {
    db.sql.exec(`DELETE FROM share_links WHERE code = 'code-1'`);
    expect((await call('PUT', '/api/favourites/shared')).status).toBe(404);
  });

  it('un-stars only the caller’s own star', async () => {
    await call('PUT', '/api/favourites/mine');
    await call('PUT', '/api/favourites/team-doc', { owner: 'acct-1', sessionAccountId: 'acct-1' });
    expect((await call('DELETE', '/api/favourites/team-doc')).status).toBe(204);
    expect((await call('DELETE', '/api/favourites/mine')).status).toBe(204);
    expect(stars()).toEqual(['acct-1:team-doc']);
  });

  it('404s a write with no document id, and an unsupported method', async () => {
    expect((await call('PUT', '/api/favourites')).status).toBe(404);
    expect((await call('POST', '/api/favourites/mine')).status).toBe(404);
    expect(stars()).toEqual([]);
  });
});
