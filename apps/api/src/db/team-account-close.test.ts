import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { detachUserFromTeams } from './teams';

// docs/specs/014-identity/profile-and-email-notifications.md "Teams on deletion": a closed account's address comes off
// every team row it had, the invitations it turned down included. An invitation still waiting is the inviter's, to
// an address rather than to the account, and stays.
function world() {
  const db = sqliteD1();
  db.sql
    .prepare(
      `INSERT INTO identity_users (id, name, email, emailVerified, image, createdAt, updatedAt)
       VALUES ('acct_c', 'Carol', 'carol@example.com', 1, NULL, 0, 0)`,
    )
    .run();
  const team = db.sql.prepare(
    'INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)',
  );
  for (const id of ['t1', 't2', 't3']) team.run(id, id);
  const row = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
  );
  row.run('a1', 't1', 'acct_a', 'ada@example.com', 'admin', 'joined');
  row.run('c1', 't1', 'acct_c', 'carol@example.com', 'member', 'joined');
  row.run('a2', 't2', 'acct_a', 'ada@example.com', 'admin', 'joined');
  row.run('c2', 't2', null, 'carol@example.com', 'member', 'declined');
  row.run('a3', 't3', 'acct_a', 'ada@example.com', 'admin', 'joined');
  row.run('c3', 't3', null, 'carol@example.com', 'member', 'invited');
  return db;
}

const carolsRows = (db: ReturnType<typeof world>) =>
  db.sql
    .prepare(
      `SELECT id, status FROM team_members WHERE user_id = 'acct_c' OR email = 'carol@example.com' ORDER BY id`,
    )
    .all()
    .map((r) => `${String(r['id'])}:${String(r['status'])}`);

describe('closing an account and its team rows', () => {
  it('takes its address off every row it had, invitations it turned down included', async () => {
    const db = world();
    await detachUserFromTeams(db.env, 'acct_c');
    expect(carolsRows(db)).toEqual(['c3:invited']);
  });

  it('matches the address whatever its case', async () => {
    const db = world();
    db.sql.prepare(`UPDATE team_members SET email = 'Carol@Example.com' WHERE id = 'c2'`).run();
    await detachUserFromTeams(db.env, 'acct_c');
    expect(db.sql.prepare(`SELECT id FROM team_members WHERE id = 'c2'`).all()).toEqual([]);
  });

  it('leaves everyone else’s rows', async () => {
    const db = world();
    await detachUserFromTeams(db.env, 'acct_c');
    expect(
      db.sql
        .prepare(`SELECT id FROM team_members WHERE user_id = 'acct_a' ORDER BY id`)
        .all()
        .map((r) => r['id']),
    ).toEqual(['a1', 'a2', 'a3']);
  });
});
