// The operator's tool for moving content into rooms (docs/specs/006-document/document-storage-move.md "The operator's
// tool"). Reads D1 through wrangler, never writes:
//
//   node --import ../../scripts/ts-source-hooks.mjs scripts/content-move.ts plan (--local | --remote) [--out plan.json]
//   node --import ../../scripts/ts-source-hooks.mjs scripts/content-move.ts verify (--local | --remote) --plan plan.json
//
// Exit 0 when every document passes, 1 when any does not, 2 on a usage or wrangler error.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  assertSelect,
  planOf,
  verifyOf,
  type PlannedDocument,
  type Query,
} from './content-move-core';

function usage(message: string): never {
  throw new Error(
    `content-move: ${message}\nusage: content-move plan (--local|--remote) [--out <file>] | verify (--local|--remote) --plan <file>`,
  );
}

function wranglerQuery(target: '--local' | '--remote'): Query {
  return async (statements) => {
    for (const s of statements) assertSelect(s);
    const out = execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'execute',
        'DB',
        target,
        '--json',
        '--command',
        statements.join(';\n'),
      ],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const answers = JSON.parse(out) as { results: Record<string, unknown>[]; success: boolean }[];
    if (answers.length !== statements.length || answers.some((a) => !a.success)) {
      throw new Error(
        `content-move: wrangler answered ${answers.length} of ${statements.length} statements`,
      );
    }
    return answers.map((a) => a.results);
  };
}

function flag(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? usage(`${name} needs a value`)) : null;
}

async function main(args: string[]): Promise<number> {
  const [command] = args;
  const target = args.includes('--remote')
    ? '--remote'
    : args.includes('--local')
      ? '--local'
      : null;
  if (!target) usage('say --local or --remote');
  const query = wranglerQuery(target);
  if (command === 'plan') {
    const plan = await planOf(query);
    console.table(
      plan.map((p) => ({ id: p.id, tabs: p.tabs, bytes: p.bytes, hash: p.hash.slice(0, 12) })),
    );
    console.log(
      `${plan.length} documents, ${plan.reduce((n, p) => n + p.tabs, 0)} tabs, ${plan.reduce((n, p) => n + p.bytes, 0)} bytes`,
    );
    const out = flag(args, '--out');
    if (out) writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }
  if (command === 'verify') {
    const file = flag(args, '--plan') ?? usage('verify needs --plan <file>');
    const plan = JSON.parse(readFileSync(file, 'utf8')) as PlannedDocument[];
    const result = await verifyOf(query, plan);
    console.table(
      result.rows.map((r) => ({
        id: r.id,
        status: r.status,
        hash: r.recomputed.slice(0, 12),
        problem: r.problem ?? 'ok',
      })),
    );
    console.log(result.pass ? 'verify: every document passes' : 'verify: FAILED');
    return result.pass ? 0 : 1;
  }
  usage(`unknown command ${command ?? '(none)'}`);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  },
);
