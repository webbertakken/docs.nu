import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { VISIBLE_DOCUMENTS_CTES } from './document-visibility';

// docs/specs/013-workspace/team-shared-documents.md: a team document is the team's. Its maker reaches it as a joined
// member, and loses it with the rest of the team's once they leave; making it grants nothing on its own.
function library() {
  const db = sqliteD1();
  db.sql
    .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run('t', 'T');
  const member = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
     VALUES (?, 't', ?, 'member', ?, 0, 0)`,
  );
  member.run('m-ada', 'ada', 'joined');
  member.run('m-bea', 'bea', 'joined');
  const doc = db.sql.prepare(
    `INSERT INTO documents (id, owner_id, team_id, name, shareable, saved_at, created_at)
     VALUES (?, ?, ?, ?, 0, 0, 0)`,
  );
  doc.run('personal', 'ada', null, 'Personal');
  doc.run('team-doc', 'ada', 't', 'Team');
  return db;
}

const visibleTo = (db: ReturnType<typeof library>, reader: string) =>
  db.sql
    .prepare(`WITH ${VISIBLE_DOCUMENTS_CTES} SELECT id, via FROM visible ORDER BY id`)
    .all(reader, Date.now())
    .map((r) => ({ id: r['id'], via: r['via'] }));

describe('the documents a person can open', () => {
  it('lists a team document its maker made as the team’s, while they are in it', () => {
    const db = library();
    expect(visibleTo(db, 'ada')).toEqual([
      { id: 'personal', via: 'own' },
      { id: 'team-doc', via: 'team' },
    ]);
    expect(visibleTo(db, 'bea')).toEqual([{ id: 'team-doc', via: 'team' }]);
  });

  it('drops a team document from its maker’s lists once they leave the team', () => {
    const db = library();
    db.sql.prepare(`DELETE FROM team_members WHERE id = 'm-ada'`).run();
    expect(visibleTo(db, 'ada')).toEqual([{ id: 'personal', via: 'own' }]);
    expect(visibleTo(db, 'bea')).toEqual([{ id: 'team-doc', via: 'team' }]);
  });

  it('drops it too while their membership is anything but joined', () => {
    const db = library();
    db.sql.prepare(`UPDATE team_members SET status = 'invited' WHERE id = 'm-ada'`).run();
    expect(visibleTo(db, 'ada')).toEqual([{ id: 'personal', via: 'own' }]);
  });
});
