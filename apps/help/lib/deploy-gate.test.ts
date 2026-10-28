import { describe, expect, it } from 'vitest';
import { deployDecision } from '../../../scripts/deploy-gate.mjs';

const PASSED = 'a'.repeat(40);
const BUILD = 'b'.repeat(40);

// docs/specs/016-platform/deployment.md "The newest green commit deploys, and production never goes back".
describe('deployDecision', () => {
  it('deploys a commit newer than the one production runs, even when main has moved on', () => {
    expect(deployDecision({ passed: PASSED, deployed: BUILD, comparison: 'ahead' })).toMatchObject({
      deploy: true,
    });
  });

  it('stands down for the commit production already runs', () => {
    expect(
      deployDecision({ passed: PASSED, deployed: PASSED, comparison: 'identical' }),
    ).toMatchObject({
      deploy: false,
    });
  });

  it('stands down for an older commit whose CI finished late, so production never goes back', () => {
    const decision = deployDecision({ passed: PASSED, deployed: BUILD, comparison: 'behind' });
    expect(decision.deploy).toBe(false);
    expect(decision.line).toBe(
      `deploy: ${PASSED} stands down: production runs ${BUILD}, the same or newer`,
    );
  });

  it("deploys when production's build is unknown", () => {
    expect(deployDecision({ passed: PASSED, deployed: null, comparison: null })).toMatchObject({
      deploy: true,
    });
  });

  it("deploys when production's build is not on main's history (a by-hand deploy of a branch)", () => {
    for (const comparison of ['diverged', null] as const)
      expect(deployDecision({ passed: PASSED, deployed: BUILD, comparison })).toMatchObject({
        deploy: true,
      });
  });
});
