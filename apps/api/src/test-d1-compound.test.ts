import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { assertD1Compound, D1_COMPOUND_MAX } from './test-d1-compound';
import { fakeD1 } from './test-d1';
import { nodeDocumentSql } from './test-document-sql';
import { sqliteD1 } from './test-sqlite-d1';

// docs/specs/003-system-architecture/testing.md "Every test database refuses what D1 refuses".

const terms = (n: number) => Array.from({ length: n }, (_, i) => `SELECT ${i} AS x`);
const six = terms(D1_COMPOUND_MAX + 1).join(' UNION ALL ');

describe('assertD1Compound refuses what D1 refuses', () => {
  it('a sixth term at one level, whichever operators join them', () => {
    expect(() => assertD1Compound(six)).toThrow(/too many terms in compound SELECT/);
    expect(() =>
      assertD1Compound(
        `${terms(3).join(' UNION ')} INTERSECT SELECT 1 EXCEPT SELECT 2 UNION SELECT 3`,
      ),
    ).toThrow(/too many terms/);
    expect(() => assertD1Compound(terms(3).join(' union all '), 2)).toThrow(/too many terms/);
  });

  it('but not five, nor terms split across levels or statements', () => {
    expect(() => assertD1Compound(terms(D1_COMPOUND_MAX).join(' UNION ALL '))).not.toThrow();
    const four = terms(4).join(' UNION ALL ');
    expect(() =>
      assertD1Compound(`SELECT * FROM (${four}) UNION ALL SELECT * FROM (${four})`),
    ).not.toThrow();
    expect(() => assertD1Compound(`${four};\n${four};`)).not.toThrow();
  });

  it('nor words in strings, quoted names or comments', () => {
    expect(() =>
      assertD1Compound(`SELECT 'a UNION b UNION c UNION d UNION e UNION f' AS x`),
    ).not.toThrow();
    expect(() =>
      assertD1Compound(`SELECT 1 AS "union union union union union union"`),
    ).not.toThrow();
    expect(() =>
      assertD1Compound(
        `-- union union union union union union\nSELECT 1 /* union union union union union union */`,
      ),
    ).not.toThrow();
  });
});

describe('every test database calls the guard', () => {
  it('the recording D1 refuses on prepare', () => {
    const { env } = fakeD1();
    expect(() => env.DB.prepare(six)).toThrow(/too many terms/);
  });

  it('the SQLite D1 refuses on prepare and on exec', async () => {
    const { env } = sqliteD1();
    expect(() => env.DB.prepare(six)).toThrow(/too many terms/);
    await expect(env.DB.exec(six)).rejects.toThrow(/too many terms/);
  });

  it("a room's SQLite refuses on exec, bound or as a script", () => {
    const sql = nodeDocumentSql(new DatabaseSync(':memory:'));
    expect(() => sql.exec(six)).toThrow(/too many terms/);
    expect(() => sql.exec(`${six};\nSELECT 1;`)).toThrow(/too many terms/);
    expect(() => sql.exec(terms(5).join(' UNION ALL '))).not.toThrow();
  });
});
