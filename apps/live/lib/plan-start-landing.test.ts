import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAN_START_LANDING,
  clearPlanStartLandings,
  setPlanStartLanding,
  takePlanStartLanding,
} from './plan-start-landing';

// docs/specs/026-plan/plan-mode.md "Start Planning lands where it was asked for": kept for the maker only, read once.
describe('plan start landing', () => {
  afterEach(clearPlanStartLandings);

  it('lands each add-menu choice on its Start Planning category', () => {
    expect(PLAN_START_LANDING).toEqual({
      board: 'boards',
      sheet: 'sheets',
      dashboard: 'dashboards',
    });
  });

  it('hands the landing to the first reader of that tab, and only once', () => {
    setPlanStartLanding('t1', 'sheets');
    expect(takePlanStartLanding('t2')).toBeUndefined();
    expect(takePlanStartLanding('t1')).toBe('sheets');
    expect(takePlanStartLanding('t1')).toBeUndefined();
  });

  it('keeps the latest landing asked for a tab', () => {
    setPlanStartLanding('t1', 'boards');
    setPlanStartLanding('t1', 'dashboards');
    expect(takePlanStartLanding('t1')).toBe('dashboards');
  });
});
