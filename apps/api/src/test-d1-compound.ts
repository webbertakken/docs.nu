// Tests only: every D1 and Durable Object SQLite stand-in calls this on each statement it prepares or runs
// (docs/specs/003-system-architecture/testing.md "Every test database refuses what D1 refuses"). D1 caps a compound
// SELECT at five terms at one level, where node:sqlite allows 500, so a query that passes a test could fail in
// production. Refuse it the way D1 does: count UNION / INTERSECT / EXCEPT at each level of parentheses, per
// statement, ignoring what sits in quotes and comments. No Worker imports this module; not a `.test.ts` file, so
// vitest doesn't collect it as a suite.

// D1's limit on the terms of one compound SELECT ("too many terms in compound SELECT"). A Durable Object's SQLite
// holds the same query limits as D1.
export const D1_COMPOUND_MAX = 5;

const QUOTED = /'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\//g;
const COMPOUND = /\(|\)|;|\b(?:UNION(?:\s+ALL)?|INTERSECT|EXCEPT)\b/gi;

export function assertD1Compound(query: string, max = D1_COMPOUND_MAX): void {
  let counts = [0];
  for (const [token] of query.replace(QUOTED, ' ').matchAll(COMPOUND)) {
    if (token === '(') counts.push(0);
    // A stray `)` (in text the quote pattern doesn't know) keeps the outer level rather than losing it.
    else if (token === ')') counts = counts.length > 1 ? counts.slice(0, -1) : [0];
    else if (token === ';') counts = [0];
    else if (++counts[counts.length - 1]! + 1 > max) {
      throw new Error('D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR');
    }
  }
}
