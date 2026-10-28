// Whether a commit that passed CI on `main` deploys production (docs/specs/016-platform/deployment.md "The newest
// green commit deploys, and production never goes back"). Used by deploy.yml's `Latest on main` job; the pure
// decision is tested in apps/help/lib/deploy-gate.test.ts.
//
//   PASSED=<sha> GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/deploy-gate.mjs
//
// Prints one `deploy:` line and, on GitHub Actions, writes `current=true|false` to $GITHUB_OUTPUT.

import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Where production says which commit it runs: every api answer carries it. */
const BUILD_URL = 'https://docs.nu/api/auth/ok';
const BUILD_HEADER = 'x-livedoc-build';
const SHA = /^[0-9a-f]{40}$/;

/**
 * @typedef {'ahead' | 'behind' | 'identical' | 'diverged' | null} Comparison
 *   GitHub's compare status of `deployed...passed`: `ahead` when the passed commit is newer; null when unknown.
 * @param {{ passed: string, deployed: string | null, comparison: Comparison }} input
 * @returns {{ deploy: boolean, line: string }}
 */
export function deployDecision({ passed, deployed, comparison }) {
  if (!deployed)
    return { deploy: true, line: `deploy: ${passed}: production's build is unknown; deploying` };
  if (comparison === 'ahead')
    return {
      deploy: true,
      line: `deploy: ${passed} is newer than production's ${deployed}; deploying`,
    };
  if (comparison === 'identical' || comparison === 'behind')
    return {
      deploy: false,
      line: `deploy: ${passed} stands down: production runs ${deployed}, the same or newer`,
    };
  return {
    deploy: true,
    line: `deploy: ${passed}: production's ${deployed} is not on main's history; deploying`,
  };
}

/** The commit production runs, or null when it cannot be read. */
async function deployedBuild() {
  try {
    const res = await fetch(BUILD_URL, { signal: AbortSignal.timeout(15_000) });
    const build = res.headers.get(BUILD_HEADER);
    return build && SHA.test(build) ? build : null;
  } catch (err) {
    console.warn(`deploy-gate: could not read ${BUILD_HEADER} from ${BUILD_URL}: ${String(err)}`);
    return null;
  }
}

/** GitHub's compare status of `base...head`, or null when GitHub cannot compare them. */
async function compare(repository, token, base, head) {
  const res = await fetch(`https://api.github.com/repos/${repository}/compare/${base}...${head}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    console.warn(`deploy-gate: compare ${base}...${head} answered ${res.status}`);
    return null;
  }
  const { status } = /** @type {{ status: string }} */ (await res.json());
  return ['ahead', 'behind', 'identical', 'diverged'].includes(status) ? status : null;
}

async function main() {
  const {
    PASSED: passed = '',
    GH_TOKEN: token = '',
    GITHUB_REPOSITORY: repository = '',
  } = process.env;
  if (!SHA.test(passed) || !token || !repository)
    throw new Error('deploy-gate: needs PASSED (a commit sha), GH_TOKEN and GITHUB_REPOSITORY');
  const deployed = await deployedBuild();
  const comparison = deployed ? await compare(repository, token, deployed, passed) : null;
  const { deploy, line } = deployDecision({
    passed,
    deployed,
    comparison: /** @type {Comparison} */ (comparison),
  });
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `current=${deploy}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
