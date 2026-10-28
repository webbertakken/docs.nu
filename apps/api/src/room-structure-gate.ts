// The room's half of a tab-scoped Editor's limits (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"):
// whether an op from a session confined to one tab keeps that tab's structure (its name, the Plan elements that pull
// cards onto it, where its form's responses go). Pure, in two steps so most ops cost no read: `structureFirst`
// answers from the op alone where it can, and `structureAgainst` answers the rest from the stored tab.
//
// What the op alone decides:
//   - an `el` add of a board, plan view or Plan card: dropped, whatever is stored;
//   - an `el` patch setting or clearing `shape`, `planBoard` or `planCard` (the fields `elementReach` reads): dropped.
//     Only the room sends a patch (a Participant's change); an Editor's client never does;
//   - an `el` reorder and an `el-delta`: relayed. A reorder never adds or removes an element, and a delta never
//     changes what an element is (a board's set-up patch refuses a result that is not a readable set-up);
//   - a `tab-meta` patch whose form keeps its targets on the tab, or carries no form: relayed;
//   - an `el` op of no kind the room knows: dropped, as no receiver could judge it either;
//   - every other op: relayed. The rename of a `tab-meta` patch is the op gate's (room-scope.ts `scopedRenames`).
// What needs the stored tab:
//   - any other `el` add, since an add of an id the tab already holds replaces that element on every receiver;
//   - an `el` update or remove, which may change or remove a stored Plan element;
//   - a whole `tab` op, judged whole and sent out under the stored name;
//   - a `tab-meta` patch pointing the form's responses off the tab, which is fine only where it was stored so.
import { elementReach } from '@livedoc/items';
import { formLeavesTab, reachIndex, sameReach, type StructuredTab } from './tab-structure';

/** The parts of a stored tab the room judges against: its name, each Plan element's reach by id, its form. */
export type StoredStructure = {
  readonly name: unknown;
  readonly reach: ReadonlyMap<string, string>;
  readonly form: unknown;
};

/** Why a scoped op is dropped: it changes the reach or the form, or can't be read. */
export type StructureWhy = 'reach' | 'form' | 'malformed';

export type FirstVerdict =
  { kind: 'relay' } | { kind: 'stored' } | { kind: 'drop'; why: StructureWhy };

/** `op` is what goes out: the op as sent, or a whole-tab op under the stored name (`renamed`). */
export type StoredVerdict =
  { kind: 'relay'; op: unknown; renamed: boolean } | { kind: 'drop'; why: StructureWhy };

const RELAY = { kind: 'relay' } as const;
const STORED = { kind: 'stored' } as const;
const drop = (why: StructureWhy) => ({ kind: 'drop', why }) as const;

// The element fields `elementReach` reads.
const REACH_FIELDS = ['shape', 'planBoard', 'planCard'];

type LooseOp = { kind?: unknown; op?: unknown; patch?: unknown; tab?: unknown };
type LooseElementOp = {
  kind?: unknown;
  element?: unknown;
  id?: unknown;
  set?: unknown;
  clear?: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const names = (list: unknown, key: string): boolean => Array.isArray(list) && list.includes(key);

export function storedStructureOf(tab: StructuredTab): StoredStructure {
  return { name: tab.name, reach: reachIndex(tab.elements), form: tab.form };
}

/** What the op alone says: relay it, drop it, or judge it against the stored tab. */
export function structureFirst(op: unknown, scope: string): FirstVerdict {
  const o: LooseOp = isObject(op) ? op : {};
  if (o.kind === 'tab') return STORED;
  if (o.kind === 'tab-meta') {
    const patch = isObject(o.patch) ? o.patch : {};
    if (Object.hasOwn(patch, 'form') && formLeavesTab(undefined, patch.form, scope)) return STORED;
    return RELAY;
  }
  if (o.kind !== 'el') return RELAY;
  const inner: LooseElementOp = isObject(o.op) ? o.op : {};
  switch (inner.kind) {
    case 'add':
      if (!isObject(inner.element)) return drop('malformed');
      return elementReach(inner.element) === null ? STORED : drop('reach');
    case 'update':
    case 'remove':
      return STORED;
    case 'patch': {
      const set = isObject(inner.set) ? inner.set : {};
      const touches = REACH_FIELDS.some((f) => Object.hasOwn(set, f) || names(inner.clear, f));
      return touches ? drop('reach') : RELAY;
    }
    case 'reorder':
      return RELAY;
    default:
      return drop('malformed');
  }
}

/** A whole-tab op under the tab's stored name, since every receiver merges that op name and all; any other op as sent. */
export function scopedTabOp(op: unknown, storedName: unknown): unknown {
  if (!isObject(op) || op.kind !== 'tab' || !isObject(op.tab)) return op;
  return { ...op, tab: { ...op.tab, name: storedName } };
}

/** An op `structureFirst` sent to the store, judged against the stored tab. */
export function structureAgainst(
  op: unknown,
  stored: StoredStructure,
  scope: string,
): StoredVerdict {
  const o: LooseOp = isObject(op) ? op : {};
  if (o.kind === 'tab') {
    if (!isObject(o.tab)) return drop('malformed');
    const tab = o.tab as StructuredTab;
    if (!sameReach(stored.reach, reachIndex(tab.elements))) return drop('reach');
    if (formLeavesTab(stored.form, tab.form, scope)) return drop('form');
    const renamed = tab.name !== stored.name;
    return { kind: 'relay', op: renamed ? scopedTabOp(op, stored.name) : op, renamed };
  }
  if (o.kind === 'tab-meta') {
    const patch = isObject(o.patch) ? o.patch : {};
    if (formLeavesTab(stored.form, patch.form, scope)) return drop('form');
    return { kind: 'relay', op, renamed: false };
  }
  const inner: LooseElementOp = isObject(o.op) ? o.op : {};
  if (inner.kind === 'remove') {
    if (typeof inner.id !== 'string') return drop('malformed');
    return stored.reach.has(inner.id) ? drop('reach') : { kind: 'relay', op, renamed: false };
  }
  const element = inner.element;
  if (!isObject(element) || typeof element.id !== 'string') return drop('malformed');
  const was = stored.reach.get(element.id) ?? null;
  return elementReach(element) === was ? { kind: 'relay', op, renamed: false } : drop('reach');
}
