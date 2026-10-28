// A picker group handed to the next start panel (docs/specs/007-editor/start-diagramming.md "Group handed over"): the
// New Document menu's All templates makes its mode's blank, and the new document's start opens on that group (Articles,
// Slides, Spreadsheets, ...) instead of Recommended. Kept for this browser tab only, and read once.
const KEY = 'livedoc:v2:start-group';

export function handStartGroup(group: string | null): void {
  try {
    if (group) sessionStorage.setItem(KEY, group);
    else sessionStorage.removeItem(KEY);
  } catch {
    // No session storage: the start opens on Recommended.
  }
}

export function takeStartGroup(): string | null {
  try {
    const group = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return group || null;
  } catch {
    return null;
  }
}
