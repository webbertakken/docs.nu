# Inbox, list and reading pane: blueprint

Derived from [Inbox](../inbox.md) §1 (What the user sees), §3 (API: `canComment`), §4 (who sees what), §5 (Explorer
integration) and §6 (Telemetry), with the roles of [Share roles](../share-roles.md) and the comment routes of
[Agent presence](../../024-agents/agent-presence.md) "Comments". The collaboration index, its writes and the read's
SQL beyond `canComment` are the spec's own (§2 to §4) and are not repeated here. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                           | Role                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/api-schema/src/activity.ts`                          | `ActivityThread.canComment`                                                            |
| `apps/api/src/db/document-visibility.ts`                       | `visible.share_level`: the level a person reaches each document at                     |
| `apps/api/src/db/collab-index.ts`                              | The threads read selects `share_level`; `canComment` on each thread                    |
| `apps/live/lib/api/comments.ts`                                | The comment client: add, delete, resolve / reopen (moved from `tabs.ts`), list threads |
| `apps/live/lib/offline/offline-activity.ts`                    | A This Browser thread carries `canComment: false`                                      |
| `apps/live/app/explorer/useActivityFeed.ts`                    | `dismiss(key)` and the dismissed set, so a done row leaves the list and the badge      |
| `apps/live/components/panels/inbox/inbox-entries.ts`           | The model: entries, filters, counts, dividers, each row's facts                        |
| `apps/live/components/panels/inbox/inbox-verbs.ts`             | `offeredVerbs`, `InboxDone`, the comment calls behind Reply and Resolve                |
| `apps/live/components/panels/inbox/useInboxFilter.ts`          | The filter choice per viewer on this device                                            |
| `apps/live/components/panels/inbox/useInboxPaneHistory.ts`     | The narrow pane's history entry, Back, and the vanished-row step back                  |
| `apps/live/components/panels/inbox/useInboxThread.ts`          | The chosen thread's comments, read once the choice settles                             |
| `apps/live/components/panels/inbox/InboxPane.tsx`              | The orchestration: filter, choice, keys, layout, live region                           |
| `apps/live/components/panels/inbox/InboxRows.tsx`              | The filter bar, the rows under their dividers, the skeleton                            |
| `apps/live/components/panels/inbox/InboxReader.tsx`            | The reading pane: where, title, byline, verbs, body, reply field                       |
| `apps/live/components/panels/inbox/InboxReaderBody.tsx`        | The pane's body per row kind                                                           |
| `apps/live/components/panels/inbox/inbox-states.tsx`           | Empty and failed states, the document chip                                             |
| `apps/live/app/explorer/ExplorerPane.tsx`                      | The Inbox section draws `InboxPane`                                                    |
| `apps/live/components/panels/explorer-panel/*`, `Explorer.tsx` | The panel's Inbox section draws `InboxPane compact`, with `inboxDone` from the editor  |
| `apps/live/components/canvas/useCanvasChromePanels.tsx`        | Builds `inboxDone` from the open document, the open tab and `onToggleActionDone`       |
| `apps/live/lib/telemetry-manifest.ts`, `apps/telemetry/app/*`  | `Activity·Changed`, `Activity·Added`, `Activity·Resolved`: manifest, charts, sentences |

## Domain and naming

| Term (spec)        | Identifier                                       | Notes                                                                                    |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Row                | `InboxEntry`                                     | One per action, card, thread, card thread, form                                          |
| Row kind           | `InboxEntryKind`                                 | `'Action' \| 'Card' \| 'Thread' \| 'CardThread' \| 'FormResponses'`, the telemetry types |
| Filter             | `InboxFilter`                                    | `'all' \| 'mine' \| 'waiting' \| 'comments' \| 'forms'`                                  |
| Date divider       | `InboxBucket`                                    | `'today' \| 'week' \| 'older'`                                                           |
| Why it is here     | `InboxReason`                                    | `{ kind, label }`, kind drives the icon                                                  |
| Row facts          | `InboxFacts` (`entryFacts`)                      | who, needsYou, title, reason, where, document, local                                     |
| Verb               | `InboxVerb`                                      | `'reply' \| 'resolve' \| 'done'`; Open is not a verb, always there                       |
| Mark Done host     | `InboxDone`                                      | `{ documentId, tabId, markDone(elementId, actionId) }`                                   |
| Done this visit    | `ActivityFeed.dismissed`, `ActivityFeed.dismiss` | Keys of rows whose work was done here                                                    |
| Stands in for list | `stacked`                                        | Narrow or compact: the pane replaces the list                                            |

The section is the Inbox in every word the reader sees; `Activity` stays the data layer's and telemetry's name
([Inbox](../inbox.md) intro). "Comments" is the filter, "thread" the row; never "conversation".

## Behaviour and state

`InboxPane` holds:

- `filter: InboxFilter`, from `useInboxFilter(viewerId)`.
- `selectedKey: string | null`. The shown row is `picked = visible.find(key)`; side by side `selected = picked ??
visible[0]`, stacked `selected = picked`. Changing the filter sets `selectedKey = null`.
- `paneOpen: boolean` (stacked only). `paneStands = stacked && paneOpen && picked !== undefined`.
- `message: string`, the polite live region's text.

Transitions:

| From          | Event                               | To / effect                                                                      |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| any           | filter chip                         | `filter = f`, stored, `selectedKey = null`, announce, `Activity·Changed·<token>` |
| side by side  | row click                           | `selectedKey = key`                                                              |
| stacked, list | row click, or ↵ / Space on the list | `selectedKey = key`, `paneOpen = true` → history entry pushed (or replaced)      |
| side by side  | ↵ on the list                       | the reader's Open link is clicked: `Activity·Selected·<kind>`, navigation        |
| pane standing | Back to Inbox, Esc, browser Back    | `paneOpen = false`; Back to Inbox and Esc step back off the entry; focus list    |
| pane standing | the open row leaves `visible`       | `paneStands` false → `useInboxPaneHistory` steps back off its own entry          |
| pane shown    | r                                   | reply field focused, when Reply is offered                                       |
| pane shown    | e                                   | Resolve or Mark Done runs, when offered                                          |
| verb running  | success (resolve / done)            | `feed.dismiss(key)`, announce, telemetry; stacked: pane closes; else list focus  |
| verb running  | failure                             | row kept, the verb's error line shown, draft kept                                |

Invariants: `selectedIndex === visible.indexOf(selected)`; a dismissed key never reappears in `entries` while the
feed lives; at most one history entry is ours at a time (`pushed` ref).

`useInboxPaneHistory(standing, onPopped)`:

- `standing` true: if `history.state[INBOX_PANE_STATE]` is already true, `replaceState({...state, flag})`, else
  `pushState({...state, flag})`; `pushed = true`; listen for `popstate` → `pushed = false`, `onPopped()`.
- `standing` false with `pushed`: `pushed = false`; if `history.state[INBOX_PANE_STATE]` is true, `history.back()`.
- `close()` (Back to Inbox, Esc): `pushed = false` then `history.back()` when the flag is on top.
- Every `history` call sits in try/catch (a sandboxed frame throws); a throw logs `[inbox] history-unavailable` once
  and leaves Back the page's.

## Interfaces and contracts

```ts
// packages/api-schema
type ActivityThread = ActivityPlace & { /* …as before… */ canComment: boolean };

// inbox-entries.ts
type InboxEntry =
  | { key: string; kind: 'Action'; forMe: boolean; row: Located<ActivityAction>; at: number }
  | { key: string; kind: 'Card'; forMe: true; row: Located<ActivityCard>; at: number }
  | { key: string; kind: 'Thread'; forMe: false; row: Located<ActivityThread>; at: number }
  | { key: string; kind: 'CardThread'; forMe: false; row: Located<ActivityCardThread>; at: number }
  | { key: string; kind: 'FormResponses'; forMe: false; row: ActivityFormResponses; at: number };
function inboxEntries(
  feed: Pick<ActivityFeed, 'assignedToMe' | 'youAssigned' | 'threads' | 'formResponses'>,
): InboxEntry[];
function inboxFilterCounts(entries: readonly InboxEntry[]): Record<InboxFilter, number>;
function filterEntries(entries: readonly InboxEntry[], f: InboxFilter): readonly InboxEntry[];
function bucketEdges(now: number): { today: number; week: number };
function bucketOf(at: number, edges: { today: number; week: number }): InboxBucket;
function entryFacts(e: InboxEntry): InboxFacts;
function entryHref(e: InboxEntry): string; // collabDeepLinkHref / cardDeepLinkHref / formResponsesHref

// inbox-verbs.ts
type InboxDone = {
  documentId: string;
  tabId: string;
  markDone: (elementId: string, actionId: string) => void;
};
function offeredVerbs(e: InboxEntry, done: InboxDone | null): readonly InboxVerb[];
function replyToThread(ownerId: string, row: ActivityThread, text: string): Promise<void>;
function resolveThread(
  ownerId: string,
  row: ActivityThread,
  thread: DocumentCommentThread | null,
): Promise<void>;
function readThread(
  ownerId: string,
  row: ActivityThread,
  signal?: AbortSignal,
): Promise<DocumentCommentThread | null>;

// lib/api/comments.ts
function apiListCommentThreads(
  ownerId: string,
  documentId: string,
  status: CommentListStatus,
  shareCode?: string | null,
  signal?: AbortSignal,
): Promise<DocumentCommentThread[]>; // throws on !ok

// InboxPane.tsx
function InboxPane(props: {
  feed: ActivityFeed;
  ownerId: string;
  compact?: boolean;
  done?: InboxDone | null;
}): JSX.Element;
```

Keys are unique and stable across reads: `a:<documentId>:<tabId>:<elementId>:<actionId>`, `c:<documentId>:<itemId>`,
`t:<documentId>:<tabId>:<elementId>`, `ct:<documentId>:<itemId>`, `f:<documentId>:<tabId>`.

`offeredVerbs` rules, in order: a `local` row → `[]`; `Thread` with `row.canComment` → `['reply', 'resolve']`;
`Action` with `done` and `done.documentId === row.documentId && done.tabId === row.tabId` → `['done']`; else `[]`.

`readThread` lists the document's open threads (`status: 'open'`, the row's `shareCode`) and returns the one with the
row's `tabId` and `elementId` and no `cell`, else null. `replyToThread` calls `apiAddComment(ownerId, documentId,
tabId, elementId, text, shareCode)` (it appends to the element's own thread). `resolveThread` uses the given thread,
else `readThread`; no thread or no comment → rejects with `thread_gone`; then `apiSetThreadResolved(ownerId,
documentId, tabId, thread.comments[0].id, true, shareCode)`.

## Data and persistence

| Field / key                                 | Class                 | Notes                                                     |
| ------------------------------------------- | --------------------- | --------------------------------------------------------- |
| `livedoc:explorer-inbox-filter:<viewer id>` | device preference     | One of the five filter ids; anything else reads `all`     |
| history state `livedocInboxPane: true`      | transient, per entry  | Merged into the router's own state, never replacing it    |
| `ActivityFeed.dismissed`                    | memory, feed lifetime | Cleared when the owner changes                            |
| thread cache                                | memory, pane lifetime | `INBOX_THREAD_CACHE_MAX` entries, keyed by row key + `at` |
| `share_level` (SQL, not stored)             | derived per read      | `'edit'` for own / team, else the visit's link level      |

No migration: `share_level` is computed from `shared_with.level` / `shared_with.role`, which exist (0010, 0080).

## Errors and edge cases

| Case                                                   | Handling                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| The feed read fails                                    | Failed state with Try again (`Activity·Loaded·Retry`); a merge read keeps the list |
| A filter holds nothing                                 | "Nothing in <filter>" with Show All                                                |
| The thread read fails or the thread is gone            | The body shows the row's latest comment; `[inbox] thread-read-failed`              |
| Reply fails (403 link changed, password, offline, 409) | "Couldn't send your reply. Try again, or open the document to reply there."        |
| Resolve fails, or `thread_gone`                        | "Couldn't resolve the thread."                                                     |
| Mark Done throws                                       | "Couldn't mark it done."                                                           |
| An empty or whitespace reply                           | Send disabled; Cmd/Ctrl+Enter does nothing                                         |
| A second verb while one runs                           | Ignored (`busy`)                                                                   |
| The chosen row leaves on a re-read (side by side)      | The pane shows the first row                                                       |
| The open row leaves (stacked)                          | The pane closes and steps back off its entry                                       |
| A key pressed in the reply field                       | Never the Inbox's (`input, textarea, select, [contenteditable]`)                   |
| Alt, Ctrl or Cmd chords                                | Never the Inbox's                                                                  |
| j/k past either end                                    | Clamped to the first or last row                                                   |
| `history` throws (sandboxed frame)                     | Logged once; Back to Inbox still closes the pane                                   |

## Security and trust

- `canComment` is a hint; the comment routes' `gateParticipate` decides every call. A forged `canComment` gets 403.
- The verbs carry the row's `shareCode` and the reader's identity (`apiHeaders`), exactly as the editor does; no
  new route, no wider grant.
- A Viewer never sees Reply or Resolve (the share-roles rule: nothing offers what the reader cannot do).
- Mark Done exists only where the editor passes `onToggleActionDone`, the same gate as the Collaborate panel.
- Telemetry types are the closed tokens above, never text, names or ids.

## Performance and limits

- The read is capped at `ACTIVITY_LIST_MAX` (100) per kind: at most 500 entries. `inboxEntries` is one pass and one
  sort (`O(n log n)`, under 1 ms at 500); counts are one pass. Both are memoised on the feed.
- Moving the choice re-renders the list's rows (memoised `InboxRow`, props unchanged except the two rows moved
  between) and the pane.
- The thread read waits `INBOX_PANE_SETTLE_MS` (200) after the choice rests, so j/k through the list asks nothing on
  the way; answers are cached (`INBOX_THREAD_CACHE_MAX`, 64).

## Presentation and UX

Copy, exactly:

| Where          | Words                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter chips   | All, My Actions, Assigned by Me, Comments, Form Responses                                                                                                                                                                    |
| Dividers       | Today, Earlier This Week, Older                                                                                                                                                                                              |
| Reasons        | To Do, Waiting on <first name \| a teammate>, Mentioned You, On Your Document, You Commented, <n> New Response(s)                                                                                                            |
| Who, no person | Plan card, Form Responses                                                                                                                                                                                                    |
| Byline         | "<who> assigned this to you", "You assigned this to yourself", "Waiting on <name>", "Assigned to you", "<who> mentioned you", "<who> commented on your document", "<who> wrote last", "<n> new response(s)"; then " · <age>" |
| Verbs          | Reply (r), Resolve (e), Mark Done (e), Open (↵)                                                                                                                                                                              |
| Reply field    | placeholder "Reply to <first name>…", button Send, hint "⌘↵ to send" / "Ctrl+↵ to send"                                                                                                                                      |
| Back           | Back to Inbox                                                                                                                                                                                                                |
| Empty filter   | Nothing in <filter>; Show All                                                                                                                                                                                                |
| Failed         | Couldn't load your Inbox; Check your connection and try again.; Try again                                                                                                                                                    |
| Live region    | "<filter>: <n> row(s)", "Reply sent", "Resolved <title>", "Marked <title> done"                                                                                                                                              |

Layout: side by side (≥ 768 px, not compact) a framed grid, list `22rem` (D185) and pane, height
`calc(100dvh - 12rem)` with a `32rem` floor (D186), each column scrolling on its own. Stacked, the list framed alone;
the standing pane `fixed inset-0 z-40` on the page (a phone's whole screen), in flow inside the panel. Rows `py-2.5`,
`min-h-11` stacked; chips `min-h-8`, `min-h-11` stacked; verbs `min-h-9`, `min-h-11` stacked.

## Accessibility

- The list: `role="listbox"`, `tabIndex=0`, `aria-label="Inbox, <filter>"`, `aria-activedescendant`; rows
  `role="option"`, `aria-selected`, an `aria-label` sentence (what. why. who. In <document>, <tab>[, This Browser]).
  Dividers `role="presentation"`.
- The filter bar: `role="group"`, `aria-label="Inbox filters"`, chips `aria-pressed`.
- The pane: `role="region"`, `aria-labelledby` its title (`h2`, `tabIndex=-1`, focused when the pane opens stacked).
- Verbs: `aria-keyshortcuts`; the key drawn in a `kbd` hidden from assistive technology and on a coarse pointer.
- The live region: `aria-live="polite"`, `sr-only`.
- Contrast: body text slate-600 / slate-300 on white / slate-800 (≥ 4.5:1); the chosen row's brand edge is
  decoration, the state is `aria-selected` plus a tinted ground; focus rings `outline-brand-600`.
- Motion: colour transitions only, `motion-reduce:transition-none`.
- Touch targets ≥ 44 px stacked (WCAG 2.5.8 needs 24; the spec asks 44).

## Web Experience

- LCP: the Inbox is client-rendered from the feed already in Explorer state; the skeleton has the list's shape so
  nothing jumps (CLS 0 from the swap: the skeleton rows are the rows' height).
- INP: a key or click updates two rows and the pane; no layout read in the handler (`scrollIntoView` after commit,
  `block: 'nearest'`).
- CLS: the pane's column is fixed width and height side by side; a verb's error line reserves no space but sits
  under the verbs, pushing only the body below it.

## Observability

| Fingerprint                   | When                                           |
| ----------------------------- | ---------------------------------------------- |
| `[inbox] reply-failed`        | A reply call rejects (with the status / error) |
| `[inbox] resolve-failed`      | A resolve call rejects                         |
| `[inbox] done-failed`         | Mark Done throws                               |
| `[inbox] thread-read-failed`  | The thread list read rejects                   |
| `[inbox] history-unavailable` | A `history` call throws                        |
| `[inbox] offline-read-failed` | (existing) the This Browser read fails         |

Successes are evidenced by their telemetry (`Activity·Added·Reply`, `Activity·Resolved·*`) and the live region.

## Testing

| Spec rule                                       | Test                                                 |
| ----------------------------------------------- | ---------------------------------------------------- |
| §3/§4 `canComment` by reach and link level      | `apps/api/src/db/activity-can-comment.test.ts`       |
| §1.2 one list newest first, dividers, row facts | `inbox-entries.test.ts`                              |
| §1.3 filters and counts                         | `inbox-entries.test.ts`, `InboxPane.test.tsx`        |
| §1.3 kept per viewer, unreadable → All          | `useInboxFilter.test.tsx`                            |
| §1.5 verbs per row, the comment calls           | `inbox-verbs.test.ts`                                |
| §1.5 done row leaves at once; failure keeps it  | `InboxPane.test.tsx`                                 |
| §1.6 keys                                       | `InboxPane.test.tsx`                                 |
| §1.7 history entry, Back, vanished row, replace | `useInboxPaneHistory.test.tsx`, `InboxPane.test.tsx` |
| §6 telemetry                                    | `InboxPane.test.tsx`, `telemetry-coverage.test.ts`   |
| thread list client                              | `apps/live/lib/api/comments.test.ts`                 |

## Constants and configuration

| Constant                 | Value                           | Provenance                           | Safe range |
| ------------------------ | ------------------------------- | ------------------------------------ | ---------- |
| `INBOX_FILTER_KEY`       | `livedoc:explorer-inbox-filter` | §1.3, beside `livedoc:explorer-view` | n/a        |
| `INBOX_STACKED_QUERY`    | `(max-width: 767px)`            | §1.7, Tailwind `md`                  | n/a        |
| `INBOX_PANE_STATE`       | `livedocInboxPane`              | §1.7                                 | n/a        |
| `INBOX_PANE_SETTLE_MS`   | 200                             | §1.4                                 | 100 to 400 |
| `INBOX_THREAD_CACHE_MAX` | 64                              | D187                                 | 16 to 256  |
| `INBOX_WEEK_DAYS`        | 6                               | §1.2 (the six days before today)     | fixed      |

## Defaults ledger

D185 to D190 in [DEFAULTS.md](DEFAULTS.md).
