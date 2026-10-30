// The pre-push hook (docs/specs/003-system-architecture/testing.md "Before a push"): runs what CI's
// Checks, Tests and Secrets would fail on, for what the push changes since its merge base with
// origin/main, so a deterministic failure surfaces on the machine first. CI still runs everything.
//
//   .githooks/pre-push -> node scripts/git-hooks/pre-push.mjs (the push's refs on stdin)

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { plainTestFilters, workspaceManifests } from '../ci-test-filters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_REF = 'origin/main';
const ZERO_SHA = /^0+$/;

// The extensions `pnpm format:check` covers (package.json).
const FORMATTED = /\.(?:ts|tsx|js|jsx|json|md|yml|yaml)$/;

// A file in no workspace: docs, root config, workflows. Only the help app's guards read these.
const OUTSIDE_WORKSPACES = /^(?!apps\/|packages\/)/;

/**
 * One check: `<command> <args>`. An optional step whose command is not installed is skipped, saying so.
 * @typedef {{ label: string, command: 'pnpm' | 'gitleaks', args: string[], optional?: boolean }} Step
 */

/**
 * @param {string} label
 * @param {string[]} args
 * @returns {Step}
 */
const pnpmStep = (label, args) => ({ label, command: 'pnpm', args });

/**
 * The secret scan of every commit the push sends, intermediate ones included: a secret added and
 * removed again still lands in the public history. It runs whatever the net diff, and first, being
 * the cheapest check and the one whose failure cannot be undone by a later commit.
 * @param {string} base the merge base with origin/main
 * @returns {Step}
 */
export function secretScanStep(base) {
  return {
    label: 'secret scan',
    command: 'gitleaks',
    args: ['git', '--no-banner', '--redact', `--log-opts=${base}..HEAD`],
    optional: true,
  };
}

/**
 * The checks for a push's changed files, in the order they run; each is `pnpm <args>`.
 * @param {string[]} changedFiles repo-relative paths changed since the merge base, deletions excluded
 * @param {string[]} coverageFilters `--filter=!<name>` per workspace with test:coverage
 * @returns {Step[]}
 */
export function prePushPlan(changedFiles, coverageFilters) {
  if (changedFiles.length === 0) return [];
  /** @type {Step[]} */
  const steps = [];
  const formatted = changedFiles.filter((f) => FORMATTED.test(f));
  if (formatted.length > 0) {
    steps.push(pnpmStep('format', ['exec', 'prettier', '--check', ...formatted]));
  }
  steps.push(
    pnpmStep('lint and typecheck', ['exec', 'turbo', 'run', 'lint', 'typecheck', '--affected']),
    pnpmStep('tests', [
      'exec',
      'turbo',
      'run',
      'test',
      '--affected',
      '--concurrency=2',
      ...coverageFilters,
    ]),
    pnpmStep('tests with coverage thresholds', [
      'exec',
      'turbo',
      'run',
      'test:coverage',
      '--affected',
      '--concurrency=2',
    ]),
  );
  if (changedFiles.some((f) => OUTSIDE_WORKSPACES.test(f))) {
    steps.push(
      pnpmStep('help guards (repo-wide references)', [
        'exec',
        'turbo',
        'run',
        'test:coverage',
        '--filter=@livedoc/help',
      ]),
    );
  }
  return steps;
}

/**
 * The local shas of the branches a push sends: git writes one line per ref,
 * `<local ref> <local sha> <remote ref> <remote sha>`. Deletions and tags carry nothing to check.
 * @param {string} stdin
 * @returns {string[]}
 */
export function pushedShas(stdin) {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([localRef, localSha]) =>
        localRef?.startsWith('refs/heads/') && localSha && !ZERO_SHA.test(localSha),
    )
    .map(([, localSha]) => /** @type {string} */ (localSha));
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main() {
  const shas = pushedShas(readFileSync(0, 'utf8'));
  if (shas.length === 0) {
    console.log('[pre-push] nothing to check: the push sends no branch commits');
    return 0;
  }
  const head = git('rev-parse', 'HEAD');
  const others = shas.filter((sha) => sha !== head);
  if (others.length > 0) {
    console.log(
      `[pre-push] skipped: the push sends ${others.map((s) => s.slice(0, 9)).join(', ')}, not the checked-out HEAD; CI checks it`,
    );
    return 0;
  }
  let base;
  try {
    base = git('merge-base', 'HEAD', BASE_REF);
  } catch {
    console.error(`[pre-push] failed: no merge base with ${BASE_REF}; run \`git fetch origin\``);
    return 1;
  }
  const changed = git('diff', '--name-only', '--diff-filter=d', base, 'HEAD')
    .split('\n')
    .filter(Boolean);
  const plan = prePushPlan(changed, plainTestFilters(workspaceManifests()));
  if (plan.length === 0) {
    console.log(`[pre-push] nothing changed since ${BASE_REF} (${base.slice(0, 9)})`);
  } else {
    console.log(
      `[pre-push] ${changed.length} files changed since ${BASE_REF} (${base.slice(0, 9)})`,
    );
  }
  const steps = [secretScanStep(base), ...plan];
  const started = Date.now();
  for (const step of steps) {
    console.log(`[pre-push] ${step.label}: ${step.command} ${step.args.slice(0, 6).join(' ')}`);
    const run = spawnSync(step.command, step.args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: 'HEAD' },
    });
    if (
      step.optional &&
      /** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ENOENT'
    ) {
      console.warn(
        `[pre-push] skipped: ${step.label}; ${step.command} is not installed (CI still runs it)`,
      );
      continue;
    }
    if (run.status !== 0) {
      console.error(`[pre-push] failed: ${step.label} (exit ${run.status ?? run.signal})`);
      return 1;
    }
  }
  console.log(`[pre-push] passed in ${Math.round((Date.now() - started) / 1000)} s`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
