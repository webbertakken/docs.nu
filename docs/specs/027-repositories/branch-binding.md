# Branch binding

**Status: specified.** Nothing is built.

A repository link binds **every git branch to the document branches of the same name**: a checkout on git branch
`feature-x` syncs with each covered document's `feature-x` [branch](../006-document/document-branches.md), and a
checkout on the link's main git branch syncs with the documents themselves. One rule holds for the whole link:
pages, file documents and diagrams alike, at every [mirror level](repository-link.md#mirror-levels).

livedocs stays the source of truth; git holds **snapshots of it on every branch**. GitHub, clones, CI and old commits
always show real plain files, so a pull request shows its documentation change as a diff beside the code it
describes, and the same change is a live document branch people and agents edit together.

## Domain language

| Term                | Means                                                                                           | Never called                     |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| **branch binding**  | The rule tying a git branch to each covered document's branch of the same name                  | branch mapping, branch sync mode |
| **main git branch** | The git branch bound to the documents themselves: `[git] branch`, the default branch unless set | live branch, trunk               |
| **sync commit**     | A commit a sync or a hook makes, holding only the link's files                                  | bot commit, docs commit          |

## The binding

| The checkout is on                | It syncs with                                         | Its commits carry                                               |
| --------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| The main git branch               | Each document's main                                  | Main's snapshot of every covered document                       |
| Any other git branch `B`          | Each document's branch `B`, in this repository        | `B`'s snapshot of the documents it branched; git's for the rest |
| Nothing (outside a git work tree) | Each document's main, as a [local copy](#without-git) | No commits                                                      |

- **The main git branch** is `[git] branch` in the link file. Absent, it is the remote's default branch as the clone
  knows it (`origin/HEAD`); a clone that does not know it is refused, "Set `[git] branch` in livedocs.toml: this clone
  does not know the default branch."
- **A git branch is an overlay.** On `feature-x`, a document with no `feature-x` branch keeps its files as git holds
  them, main's snapshot from where the git branch started or last took main. A sync there neither writes nor reads
  them until one changes; `link status` lists them as `behind main` when main has moved, never as a failure. A pull
  request so shows only its own documentation change, and two pull requests never conflict over a document neither
  of them changed.
- **The repository** a branch belongs to is named by its first commit, so every clone and fork of it agrees, and a
  different repository's git branch of the same name never meets it
  ([Document branches](../006-document/document-branches.md#names)).
- **At `none` and `index`**, where there are no files to commit, the binding still holds: the CLI on a git branch reads
  and writes its document branches ([Agents](../006-document/document-branches.md#agents)).

### Names

- A git branch named `main` while the main git branch is another is refused, never bound: "On main: this link's main
  git branch is <branch>. Rename this git branch to sync it."
- A git branch name longer than `DOCUMENT_BRANCH_NAME_MAX_BYTES`, or equal to an open document branch's name apart
  from letter case, is refused for the documents it would collide on, naming the other branch.
- A git branch is refused once, at the first sync on it, and again each time the sync runs; nothing is written or
  sent for it, and the commit goes through.

## A clean footing

A sync runs, on any git branch, only from a clean footing. Anything else is refused with the state and its fix, and
changes nothing:

| State                                                  | Refusal and fix                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Detached `HEAD`                                        | "HEAD is detached at <sha>: `git switch <branch>` to sync, or `link status --branch <name>`"        |
| A rebase, merge, cherry-pick, revert or bisect running | "A <operation> is in progress: finish it (`git <operation> --continue`) or abort it, then sync"     |
| A file git left conflicted                             | Names the file and `livedocs sync --resolve <file>` ([Conflicts git leaves](#conflicts-git-leaves)) |
| Git is busy (`index.lock` held)                        | Waits up to `SYNC_LOCK_WAIT_MS`, then "Git is busy in this work tree: try again"                    |
| A shallow clone that lacks a snapshot's commit         | Syncs; a file whose base it cannot reach merges [baseless](repository-link.md#merging)              |

`link status` reads on any footing, a detached `HEAD` included: it judges each snapshot against the branch its record
names ([In CI](#in-ci)).

## Files on every branch

- **Files are always committed**, on every git branch: each commit carries the snapshot of its document branches, and
  the main git branch carries main. A page arrives as its markdown, byte for byte
  ([Markdown tab](../031-markdown/markdown-tab.md#the-round-trip)); which files are committed at all is
  [Committed files](committed-files.md).
- **Each snapshot names its branch**: a native file's [sync record](native-files.md#the-sync-record) and a mirror
  file's sync data say which document branch and revision the file holds, so any clone, CI job or later merge knows
  what it is looking at.
- **A file is a snapshot of whichever record its bytes match.** A file matching a record is never an edit, whichever
  branch the record names; a file matching none is an edit, folded back from the nearest of their snapshots
  ([Folding a file back](native-files.md#folding-a-file-back)). Checkouts, pulls, merges and rebases so never read as
  edits.
- **`INDEX.md` is main's**: it is written on the main git branch only. On another git branch it stays as git holds
  it, and the CLI lists the branch's documents.

## Starting a branch from git

- **A git branch's first change** to a covered document (a file edited, created, moved or deleted under `dir`, by
  anyone, with or without the CLI) starts that document's branch of the git branch's name at the next sync, from the
  revision the file's record names: the branch then holds exactly that git branch's change, and the pull request
  shows only it.
- **A new file** on a git branch creates a document that exists only on its branch
  ([Document branches](../006-document/document-branches.md#what-a-branch-holds)); a **deleted file** marks its
  document deleted on the branch, never on main; a **move** renames or moves it on the branch.
- **A git branch started from another** (`git switch -c feature-y feature-x`) holds `feature-x`'s snapshots. Its first
  change starts `feature-y` from `feature-x` at the revision the record names; a document it never changes stays
  `feature-x`'s snapshot in its files.
- **A git branch whose document branch has merged** and that changes the document again starts a new branch of the
  same name, from main as the merge left it; its change folds in from the nearest base.
- **A document branch started in livedocs** reaches git when someone creates a git branch of its name and syncs
  there: the sync writes the branch's snapshot, and the next commit carries it.

## While people and agents work

People and agents edit either way, through livedocs (the browser, the CLI, the MCP server) or the files; both reach
the same document branch.

- **`livedocs sync --watch`** on a git branch keeps the work tree and its document branches in step, both ways, as on
  main ([While people and agents edit](native-files.md#while-people-and-agents-edit)): a file saved in the work tree
  reaches everyone on the branch in livedocs once it settles.
- **Git moving under a watch.** The watch reads `HEAD` before every sync. While git works (a checkout, pull, merge,
  rebase or reset; `index.lock` held, or an operation in progress) it folds nothing back; once git is done it
  re-binds to the git branch now checked out and reads the records anew, so a checkout's rewritten files are
  snapshots, never edits.
- **Worktrees**: each worktree syncs its own git branch, with its own local sync state, so an agent per worktree edits
  its own document branch while another edits main.
- **A pull or checkout blocked by the sync's own files.** With `[git] commit = "none"`, a sync leaves the snapshots it
  wrote uncommitted, and git refuses a pull or checkout that would overwrite them. `livedocs link clean` puts back
  git's version of every file whose bytes are a snapshot livedocs holds (nothing unsent, so nothing is lost) and of
  the records; git then proceeds, and the next sync writes them again. A file holding an unsent edit is kept and
  named.
- **A git revert or reset of a documentation change** puts an older snapshot back; it is a snapshot, never an edit, so
  the next sync writes the current one and says "<path> held an older snapshot (<rev>): wrote <rev>. To take a change
  back, undo it in livedocs." livedocs's history is the document's, git's is the files'.

## The hooks

The hooks keep every commit and push carrying the current snapshot. Each runs the same `livedocs` command through the
guarded hook line ([The hooks](repository-link.md#the-hooks)), so a teammate without the CLI commits as before.

- **Pre-commit** (and **pre-merge-commit**): one sync of the checked-out git branch's binding, then `git add` of
  exactly the files it wrote. Every commit carries the snapshot as it was when the commit was made, on every git
  branch.
- **Pre-push** checks; it cannot add to the push it runs in, because git has decided what to send before the hook
  runs. For each pushed git branch it asks whether livedocs moved since that branch's last commit:
  - **Current**: the push goes through.
  - **Moved, the branch checked out**: it syncs, makes one sync commit holding only the link's files (other staged
    changes stay staged, never committed), stops the push and says "Docs updated: <n> documents. Push again."
  - **Moved, the branch not checked out** (`git push origin other-branch`): the push goes through with one line
    naming the documents behind; `[hooks] block = true` stops it instead.
  - **A push stops once.** A push whose head is the hook's own sync commit goes through even when livedocs moved
    again since, naming what it leaves behind: a page someone is typing in never holds a push back forever.
  - Offline, signed out, past `SYNC_HOOK_BUDGET_MS`, or a deleted remote branch: the push goes through with one line,
    as the pre-commit hook does.
- **`git push --no-verify`** and pushes from clones without the CLI skip the check; CI catches them.

### In CI

`livedocs link status --fail-behind` answers whether a commit's snapshots are current, before a pull request merges.

- It judges every snapshot against the document branch its record names, so it works on the detached merge commit a
  CI service checks out: it fails when a document branch the pull request carries has moved in livedocs since its
  snapshot, and names each.
- **Main's snapshots count only on main**: `--branch main`, or a checkout on the main git branch, fails when main is
  behind; on a pull request, documents it never branched are listed and never fail it.
- Without a token (a pull request from a fork, a repository without the secret), it says so and exits 0.
- A CI job on the main git branch may also run `livedocs sync` with a token: it merges merged pull requests' document
  branches into main in livedocs ([A pull request merging](#a-pull-request-merging)) and commits nothing unless
  `[git] commit` says so.

## Merging in git

Git merges files; livedocs merges documents. Each git merge is recognised from the records the merged files carry,
and becomes the same merge in livedocs.

### Main into a branch

`git merge main` (or a rebase onto it) on `feature-x` brings main's newer snapshots into the git branch. The next sync
finds records naming main at a newer revision than `feature-x`'s branch point and **updates the document branch from
main** ([Merging](../006-document/document-branches.md#merging)); it then writes the branch's result, so the work tree
holds livedocs's merge.

### A pull request merging

A pull request merged on GitHub (a merge, a squash or a rebase alike) leaves on main files that carry `feature-x`'s
records. The next sync on main, by anyone (a person, a watch, a hook, a CI job):

1. finds each record naming document branch `feature-x` at revision `N`;
2. **merges `feature-x` up to `N` into main** in livedocs: what git merged is what the pull request's reviewers saw;
3. **closes the branch** when nothing on it is newer than `N`; edits made on it after `N` stay open on it
   ([Closing a branch](../006-document/document-branches.md#closing-a-branch));
4. folds back, from the branch's snapshot, any file whose merged bytes differ from it (a conflict resolved by hand in
   GitHub, or main's changes git merged in), as any file edit: a change both made is taken once;
5. writes main's result over the files, with main's records, and removes the merged branch's records.

- A record naming a branch already merged at or past its revision is a clean snapshot: the sync writes main over it.
- A record naming a branch that is discarded or purged is folded back as an edit from its snapshot, as a pull
  request made without the CLI is ([Without the CLI](#without-the-cli)).
- A pull request into another git branch (`feature-y` into `feature-x`) merges the document branches likewise, into
  `feature-x`'s.

### Conflicts git leaves

- **A page or file git left conflicted** on any branch is refused until resolved. `livedocs sync --resolve <file>`
  reads git's three versions, merges the two document branches they name in livedocs (by character for a page, by
  element for a diagram, as the branch merge does) and writes and stages the result. Without the CLI, a person
  resolves the file in git; the next sync folds the resolution back as an edit.
- **A record git left conflicted** happens only when two clones synced the same document branch to different
  revisions; the merge driver takes the higher revision of the one branch, and `sync --resolve` does the same. A
  record edited by hand into nonsense is rebuilt, never trusted ([The sync record](native-files.md#the-sync-record)).
- **A conflicted `INDEX.md`** holds nothing written by hand: `sync --resolve INDEX.md` regenerates it.

## Main after a merge

GitHub merges without running local hooks, so when main moved in livedocs while a pull request was open, the merged
result in livedocs differs from what git's main holds.

- **Nobody writes a follow-up commit**: no bot and no sync pull request. Git's main stays behind until the next commit
  made on it by anyone, whose pre-commit hook carries the current snapshot.
- `link status` reports main as `behind`, with the revisions it lacks; it never fails a build unless asked
  (`--fail-behind` on main).
- **A protected main** follows the same rule: its files catch up when a commit lands on it carrying a newer snapshot.
- **`[git] commit`** (`none`, `commit`, `push`) stays for links whose main git branch accepts direct commits, such as a
  whole-repository global wiki. On any git branch, a push the remote refuses for its rules (a protected branch, no
  permission) is never forced or retried around: the sync commit stays local, is reported once with "<branch> refuses
  pushes: set `[git] commit = "none"` for this link", and the link stops committing on that git branch in this clone
  until the setting changes. A push refused because the remote moved is fetched, rebased and retried as
  [Native files](native-files.md#git) says.

## Renamed git branches

- **A rename follows.** `git branch -m old new` is read from the git branch's reflog at the next sync; the document
  branches named `old` in this repository are renamed `new`, keeping their content, presence and Timeline.
- **A rename made in another clone** shows as a git branch whose records name `old` while `old` no longer exists,
  locally or on the remote: the sync renames the document branches then. While `old` still exists, the new git branch
  is a branch started from `old` ([Starting a branch from git](#starting-a-branch-from-git)), so nothing is ever
  renamed on a guess.
- A rename onto a name an open document branch already holds is refused for those documents, naming the branch.

## Deleted git branches

- **A git branch deleted unmerged** discards its document branches after the grace: they stay restorable for
  `DOCUMENT_BRANCH_GRACE_DAYS`, as the Trash keeps a document
  ([Closing a branch](../006-document/document-branches.md#closing-a-branch)).
- **How deletion is known**: a sync in a clone of the repository finds a git branch it synced before gone from the
  clone and from its remote (after the fetch git last made), or a remote-tracking branch it saw before pruned. A git
  branch that only ever lived in another clone is never declared deleted by this one. Nobody syncing means nothing is
  discarded: an open branch waits.
- **A git branch merged and then deleted** has already closed its document branches through the merge.
- **A git branch recreated** within the grace (the same name, the same repository) restores its discarded document
  branches when its first sync finds their records.

## Without the CLI

Opting in is per person; the repository works the same for everyone else.

- **The hook line is guarded**: a clone without the CLI commits and pushes as before.
- **A pull request made purely in git** lands on main as file changes with main's records unchanged. The next sync on
  main folds them back into livedocs from their base, the snapshot their record names, as any file edit.
- **A git branch edited without the CLI** while others sync it: the next sync on it by anyone folds the hand-made
  change into its document branch.

## Without git

Outside a git work tree a link is a **local copy**: a live two-way sync between livedocs and a folder of plain files,
always with main. There are no branches, hooks or commits; everything else in
[Native files](native-files.md) holds.

## Observability and telemetry

- Fingerprints, with the link id, document ids and a hash of the git branch name, never names or content:
  `[binding] bound` (main or branch), `[binding] refused` (with the state), `[binding] started-branch`,
  `[binding] updated-from-main`, `[binding] merge-found` (with the revision), `[binding] merged`,
  `[binding] renamed`, `[binding] deleted-branch`, `[binding] rebound` (after git moved under a watch),
  `[binding] older-snapshot`, `[hook] pre-push-current`, `[hook] pre-push-stopped`, `[hook] pre-push-passed-stale`,
  `[sync] push-refused-rules`, `[sync] cleaned`.
- Telemetry: category `Cli`, action `Used`, type `LinkClean` for `link clean` and `SyncResolve` for `--resolve`; a
  pre-push stop counts as `HookPrePush`.
