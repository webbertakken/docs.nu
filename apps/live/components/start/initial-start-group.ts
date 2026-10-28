// Where a start panel opens (docs/specs/007-editor/start-diagramming.md "Group handed over"): on the group the New
// Document menu's All templates handed over (start-group.ts), when the panel has it, else on Recommended.
import { debugLog } from '@/lib/debug-log';

export const RECOMMENDED_GROUP = 'recommended';

export function initialStartGroup<C extends string>(
  taken: string | null,
  groups: readonly C[],
): C | typeof RECOMMENDED_GROUP {
  if (taken === null) return RECOMMENDED_GROUP;
  const known = groups.find((g) => g === taken);
  if (known === undefined) {
    debugLog('[start] group-unknown');
    return RECOMMENDED_GROUP;
  }
  debugLog(`[start] group=${known}`);
  return known;
}
