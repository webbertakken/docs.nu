// Where Start Planning lands on a Plan start made from the add menu (docs/specs/026-plan/plan-mode.md "Start Planning
// lands where it was asked for"): Board on Boards, Sheet on Spreadsheets, Dashboard on Dashboards. The maker's alone:
// kept in memory, never stored or synced, and read once by the start as it opens.
export type PlanStartLanding = 'boards' | 'sheets' | 'dashboards';
export type PlanTabChoice = 'board' | 'sheet' | 'dashboard';

export const PLAN_START_LANDING: Readonly<Record<PlanTabChoice, PlanStartLanding>> = {
  board: 'boards',
  sheet: 'sheets',
  dashboard: 'dashboards',
};

const landings = new Map<string, PlanStartLanding>();

export function setPlanStartLanding(tabId: string, landing: PlanStartLanding): void {
  landings.set(tabId, landing);
}

/** The landing asked for `tabId`, taken out so a later opening of the same tab lands on Recommended. */
export function takePlanStartLanding(tabId: string): PlanStartLanding | undefined {
  const landing = landings.get(tabId);
  landings.delete(tabId);
  return landing;
}

/** For tests. */
export function clearPlanStartLandings(): void {
  landings.clear();
}
