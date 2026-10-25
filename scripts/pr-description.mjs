// The slots below a pull request's description: sections CI scripts fill and empty, at the very
// bottom in one fixed order, never touching what the author wrote. A description edit notifies no
// one, where a comment emails every watcher. Used by scripts/coverage-report.mjs and
// scripts/preview.mjs; the pure helpers are tested in apps/help/lib/pr-description.test.ts.

/** Top to bottom. A slot not listed here has no place, and is refused. */
export const SLOT_ORDER = ['coverage-report', 'preview'];

/** The HTML comments that bound a slot, invisible in the rendered description. */
export function slotMarkers(/** @type {string} */ name) {
  if (!SLOT_ORDER.includes(name)) throw new Error(`pr-description: unknown slot ${name}`);
  return { start: `<!-- livedoc:${name}:start -->`, end: `<!-- livedoc:${name}:end -->` };
}

/** Every slot's content in the description, and the description without them. */
function parse(/** @type {string} */ text) {
  /** @type {Map<string, string>} */
  const slots = new Map();
  let rest = text;
  for (const name of SLOT_ORDER) {
    const { start, end } = slotMarkers(name);
    const from = rest.indexOf(start);
    if (from === -1) continue;
    const to = rest.indexOf(end, from);
    // A closing marker edited away: the slot runs to the end of the description.
    const until = to === -1 ? rest.length : to + end.length;
    const inner = rest.slice(from + start.length, to === -1 ? rest.length : to);
    slots.set(name, inner.replace(/^\r?\n/, '').replace(/\r?\n$/, ''));
    rest = `${rest.slice(0, from).trimEnd()}${rest.slice(until)}`;
  }
  return { slots, author: rest };
}

/**
 * The description with one slot filled (or emptied, with null): the author's text first, then every
 * filled slot in SLOT_ORDER.
 */
export function withSlot(
  /** @type {string | null | undefined} */ body,
  /** @type {string} */ name,
  /** @type {string | null} */ content,
) {
  slotMarkers(name);
  const { slots, author } = parse(body ?? '');
  if (content === null) slots.delete(name);
  else slots.set(name, content);
  const blocks = SLOT_ORDER.filter((n) => slots.has(n)).map((n) => {
    const { start, end } = slotMarkers(n);
    return `${start}\n${slots.get(n)}\n${end}`;
  });
  const kept = author.replace(/^\s+$/, '').trimEnd();
  const tail = blocks.join('\n\n');
  if (!tail) return kept;
  return kept ? `${kept}\n\n${tail}` : tail;
}

/**
 * Fills or empties one slot of a pull request's description on GitHub. Read just before writing, so
 * an edit the author made meanwhile is kept. Returns what happened, for the caller's log.
 * @param {{ repository: string, token: string, pr: number | string, name: string, content: string | null }} options
 */
export async function writeSlot({ repository, token, pr, name, content }) {
  const url = `https://api.github.com/repos/${repository}/pulls/${pr}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const read = await fetch(url, { headers });
  if (!read.ok) throw new Error(`GET ${url} answered ${read.status}: ${await read.text()}`);
  const { body } = /** @type {{ body: string | null }} */ (await read.json());
  const next = withSlot(body, name, content);
  if (next === (body ?? '')) return 'unchanged';
  const write = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ body: next }),
  });
  if (!write.ok) throw new Error(`PATCH ${url} answered ${write.status}: ${await write.text()}`);
  if (content === null) return 'emptied';
  return body?.includes(slotMarkers(name).start) ? 'updated' : 'added';
}
