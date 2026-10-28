// A tab-scoped session's ops in the room (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"): each keeps
// its tab's structure or is dropped (room-structure-gate.ts). The stored tab is the room's own (its SQLite, read
// synchronously), so an op is judged as it arrives: the session's ops keep their order, and a session without a
// scope never comes here.
//
// The stored tab trails the live one by the autosave: an op is judged against the tab as last saved. Where the room
// stores no such tab (a room whose content has not moved in yet, or a tab not saved yet) an op needing the store
// passes as sent, as the whole-tab op's name does: the save that writes the tab keeps its structure anyway
// (`keepStoredStructure`).
import { migrateStoredTab, type Tab } from '@livedoc/document';
import {
  storedStructureOf,
  structureAgainst,
  structureFirst,
  type StoredStructure,
  type StructureWhy,
} from './room-structure-gate';

/** The room's SQLite as this module reads it: `ctx.storage.sql`, or null while the room stores no document yet. */
export type TabStore = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

/** Where a scoped session's op lands: its document (for the logs) and its tab. */
export type ScopedWhere = { documentId: string | null; tabId: string };

// How many tabs' stored structure one room keeps parsed: a room's scoped sessions are usually on one tab or two.
export const SCOPED_TABS_CACHED = 4;

const kindOf = (op: unknown): unknown => (op as { kind?: unknown } | null)?.kind;

export class RoomScopedStructure {
  // Each tab's parsed structure under the version it was parsed at (`rev:updated_at`; every write moves one), so a
  // scoped Editor's update costs one indexed read, not a parse of the whole tab. Least recently judged first.
  private readonly parsed = new Map<string, { version: string; structure: StoredStructure }>();
  private readonly store: () => TabStore | null;

  constructor(store: () => TabStore | null) {
    this.store = store;
  }

  /** The op as it goes out from a session scoped to `where.tabId` (`{ op }`), or null when it is dropped. */
  admit(op: unknown, where: ScopedWhere): { op: unknown } | null {
    const first = structureFirst(op, where.tabId);
    if (first.kind === 'drop') return dropped(op, where, first.why);
    if (first.kind === 'relay') return { op };
    let stored: StoredStructure | null;
    try {
      stored = this.storedStructure(where.tabId);
    } catch (err) {
      // A check that cannot run relays nothing: the op is refused rather than let through unjudged.
      console.warn('[room] scoped check failed', {
        ...where,
        kind: kindOf(op),
        error: String(err),
      });
      return null;
    }
    if (stored === null) {
      console.info('[room] scoped structure unjudged', { ...where, kind: kindOf(op) });
      return { op };
    }
    const verdict = structureAgainst(op, stored, where.tabId);
    if (verdict.kind === 'drop') return dropped(op, where, verdict.why);
    if (verdict.renamed) console.info('[room] scoped tab op renamed back', where);
    return { op: verdict.op };
  }

  // The stored tab's structure, or null when the room stores no such tab.
  private storedStructure(tabId: string): StoredStructure | null {
    const sql = this.store();
    if (sql === null) return null;
    const head = sql.exec('SELECT rev, updated_at FROM tabs WHERE id = ?', tabId).toArray()[0];
    if (!head) {
      this.parsed.delete(tabId);
      return null;
    }
    const version = `${String(head.rev)}:${String(head.updated_at)}`;
    const hit = this.parsed.get(tabId);
    this.parsed.delete(tabId);
    if (hit?.version === version) {
      this.parsed.set(tabId, hit);
      return hit.structure;
    }
    const row = sql.exec('SELECT name, data FROM tabs WHERE id = ?', tabId).toArray()[0];
    if (!row || typeof row.data !== 'string') return null;
    const data = migrateStoredTab(JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>);
    const structure = storedStructureOf({ ...data, name: row.name });
    this.parsed.set(tabId, { version, structure });
    while (this.parsed.size > SCOPED_TABS_CACHED)
      this.parsed.delete(this.parsed.keys().next().value!);
    return structure;
  }
}

function dropped(op: unknown, where: ScopedWhere, why: StructureWhy): null {
  console.info('[room] scoped structure dropped', { ...where, kind: kindOf(op), why });
  return null;
}
