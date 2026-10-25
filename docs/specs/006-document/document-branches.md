# Document branches

**Status: specified.** Nothing is built.

A **document branch** is a named, live copy of a document, edited without touching the document itself. The document
itself is its **main**. A branch is worked on as main is: together, in real time, with presence and the rich editor,
by people and agents alike; when it is ready it **merges** into main, and when it is not wanted it is **discarded**.

LiveDoc is the source of truth for every branch, as for main. A
[repository link](../027-repositories/repository-link.md) binds each git branch to the document branches of the same
name ([Branch binding](../027-repositories/branch-binding.md)), so a pull request's documentation is a document branch
that people edit live, review in git and merge with the code it describes. Branches work as well without any
repository.

## Domain language

| Term                | Means                                                                                         | Never called                            |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| **document branch** | A named, live copy of a document, edited without touching main                                | fork, draft, copy, variant, version     |
| **main**            | The document itself, as its branches see it                                                   | trunk, master, original, default branch |
| **branch point**    | What a branch started from: main or another branch, at a revision of each tab                 | fork point, base (that is the sync's)   |
| **merge**           | Bringing a branch's changes into main (or into another branch) from their latest shared state | publish, apply, accept                  |
| **unmerged change** | A stretch or field both sides changed differently, kept beside the result, never applied      | conflict (that is a changeset's 409)    |
| **discard**         | Closing a branch without merging it; restorable for `DOCUMENT_BRANCH_GRACE_DAYS`              | delete, abandon, reject                 |

- "Branch" alone means a document branch in LiveDoc copy and specs about documents; a git branch is always called a
  git branch.
- A branch belongs to one document. The same name on several documents (a git branch that changed three pages) is
  several branches, one per document, listed together by name ([Viewing branches](#viewing-branches)).

## What a branch holds

A branch holds everything a changeset or an editor can change in the document:

- Every tab's content: a page's text, a file document's bytes, a diagram's elements, any tab kind's own content.
- The set of tabs: tabs added on the branch, tabs removed on it, and their order.
- The document's **name and folder**, so a rename or a move made on a branch reaches main only when it merges.
- **Whether the document exists**: a document **created on a branch** exists only there until it merges; a document
  **deleted on a branch** is still on main until the branch merges, and then moves to the [Trash](../013-workspace/trash.md).
- **Its own margin notes and comments**: those made on the branch belong to it, join main when it merges, and go with
  it when it is discarded. Main's own notes show on the branch wherever their stretch or element still exists.

A branch shares with main what is the document's rather than its content: its id and
[document address](../032-wikis/links.md#domain-language), owner, share links and roles, tags, its Timeline (each
branch event is a Timeline event), and its place in the Explorer. Live session data (votes, answers, form responses,
ticks) is main's only: a branch shows main's, and offers adding them on main.

## Starting a branch

- **By hand**: **Branch** in the document's menu, for an Editor, asks for a name and starts the branch from main as it
  is now. The person lands on the new branch.
- **By a git branch's first change**: a sync on a git branch that finds a covered document's file changed, created,
  moved or deleted starts that document's branch of the git branch's name, from the revision the file was a snapshot
  of ([Branch binding](../027-repositories/branch-binding.md#starting-a-branch-from-git)).
- **By an agent's first write**: the CLI and the MCP server write to a named branch; inside a linked work tree the CLI
  writes to the branch of the work tree's git branch, starting it on its first write ([Agents](#agents)).
- **From another branch**: a branch may start from another branch of the same document, as a git branch may start
  from another. Its branch point names that branch, and it merges into whatever it is merged into.
- **The branch point is pinned.** LiveDoc keeps what a merge needs from the branch point while the branch is open:
  main's state at that revision, and for a page every character a branch's edits are anchored to, so a merge always
  merges by character, however old the branch.
- A branch whose branch point LiveDoc no longer holds (a git branch started months ago from a revision long
  compacted) starts from that revision's snapshot as git holds it, byte for byte; a page's merge back is then a
  three-way merge of the snapshot's text, the branch and main, still by character.

## Names

- **A branch name is a git branch name**, so any branch can later bind to git: it follows git's own rules for a branch
  name (`git check-ref-format --branch`), `/` included (`feature/login`), at most `DOCUMENT_BRANCH_NAME_MAX_BYTES`.
  A name that breaks them is refused naming the rule: "“<name>” can’t be a branch name: <rule>."
- **`main` is reserved** for the document itself. A git branch called `main` in a repository whose link names
  another main git branch is refused, never bound ([Branch binding](../027-repositories/branch-binding.md#names)).
- **Names are unique per document**, compared case-insensitively, as git's refs are on macOS and Windows. A second
  `Feature-X` beside `feature-x` is refused naming the first.
- **A branch belongs to the repository it came from.** A branch started by a git branch is bound to that repository
  (its identity is the repository's first commit, so every clone and fork agrees). Another repository's git branch of
  the same name starts its own branch, and both are listed with their repository. A branch started by hand belongs
  to no repository until a git branch of its name first syncs with it.
- **Renaming** a branch in LiveDoc is offered for a branch no repository holds; a bound branch follows its git branch
  ([Branch binding](../027-repositories/branch-binding.md#renamed-git-branches)), so renaming it in LiveDoc is
  refused with "Rename the git branch <name>; this branch follows it."

## Viewing branches

- **The branch switcher** sits beside the document's name while the document has any open branch: **main**, then
  each open branch with its repository, who started it, its last change and the people on it now. Picking one opens
  the document on that branch. A document without branches shows no switcher; **Branch** stays in its menu.
- **A branch's address** is the document's address with `?branch=<name>` (percent-encoded), so a link opens the
  branch. A branch that has merged opens main, saying "<name> was merged into main <when>"; a discarded branch opens
  main, offering **Restore** while it can.
- **A branch shows that it is one**: a band under the header names the branch, its branch point ("from main, 3 days
  ago") and **Compare with main** and **Merge into main**. Nobody mistakes a branch for main.
- **Presence is per branch.** Each branch is its own room: carets, cursors and selections are of the people on it.
  The switcher counts the people on every branch, so someone on main sees that others are on a branch.
- **Compare with main** shows the branch's changes since its branch point and main's changes since then:
  - a page as its rendered text, with insertions and deletions marked by word, a margin mark on each changed
    paragraph;
  - a diagram or any canvas tab as the two side by side, the changed elements outlined, added and removed ones marked;
  - a file document as both versions, shown as the [file tab](file-tab.md#showing-it) shows them;
  - a rename, a move, tabs added or removed, and a creation or deletion, each as one line;
  - every stretch or field that would merge as an **unmerged change**, listed first.
- **In the Explorer** a document created on a branch, and so absent from main, is listed in its folder with a badge
  naming the branch ("Only on feature-x"); opening it opens the branch. Documents with open branches carry a small
  branch mark with the count.
- **Links within a branch**: a page on a branch opens its links' targets on the branch of the same name where one
  exists, and on main otherwise ([Links](../032-wikis/links.md#link-forms)).

## Merging

A merge brings a branch's changes into main as **one changeset on main**, credited to the person merging (or, for a
merge found in git, to the person or token syncing), with the summary "Merged <branch>". It merges each tab three
ways: the **latest state both sides share** (the branch point, or a later merge between them), the branch, and main
now.

| Content         | Merges                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| A page          | By character, as live edits do ([Markdown tab](../031-markdown/markdown-tab.md#how-the-merge-works)) |
| A diagram       | By element, field by field ([Merging](../027-repositories/repository-link.md#merging))               |
| Any canvas tab  | By element, as a diagram                                                                             |
| A file document | Whole: the side that changed it; both changed is an unmerged change                                  |
| Name and folder | The side that changed it; both changed differently is an unmerged change                             |
| Tabs            | Added and removed as either side did; an edit outranks a removal                                     |
| Existence       | A document created on the branch is created on main; deleted on the branch, it moves to the Trash    |

- **A change only one side made is taken; the same change made on both is taken once.**
- **An edit outranks a delete**, as in every sync: a document deleted on the branch but changed on main since the
  branch point stays, and the merge says so; an element or tab removed on one side and changed on the other is kept.
- **Unmerged changes are shown, never dropped.** Where both sides changed the same stretch or field differently,
  main's version stands and the branch's is kept beside it:
  - on a page, as a margin note on the stretch, "Not merged from <branch>: <the branch's text>";
  - on a diagram, as a comment on the element, "Not merged from <branch>: label was "Start game"";
  - for a file document, the branch's bytes as a [previous version](file-tab.md#changing-it), with a note on the tab;
  - for a name or folder, as a note on the document.

  Each note is by the person merging, so whoever reads the document sees it and settles it. The merge's report lists
  them, and stays on the merged branch's Timeline event.

- **Merging by hand** (**Merge into main**, for an Editor) opens Compare with main first. Each unmerged change can be
  settled there before merging: **Keep main's**, **Take the branch's**, or edited by hand. Whatever is left unsettled
  merges as above. Nothing merges until the person confirms.
- **Merging found in git** (a pull request merged, its files on main naming the branch) merges the branch up to the
  revision git merged, as above ([Branch binding](../027-repositories/branch-binding.md#a-pull-request-merging)).
- **Main moving during a merge**: the merge is based on main's revision as it read it; when main moved meanwhile it
  re-reads and merges again, up to `SYNC_MERGE_ATTEMPTS`
  ([Repository link](../027-repositories/repository-link.md#limits)) times, then reports the branch as not merged,
  changing nothing.
- **Merging into another branch** follows the same rules with that branch in main's place.
- **Updating a branch from main** (**Update from main**) merges main's changes since the branch point into the
  branch, by the same rules with the branch's version standing; the shared state moves to main's revision.

## Closing a branch

A branch closes in one of three ways; a closed branch leaves the switcher.

| Way           | When                                                                                       | Afterwards                                                              |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Merged**    | Merged into main with nothing after the revision merged                                    | Its content is main's; its Timeline event and report remain             |
| **Discarded** | **Discard branch** by an Editor, or its git branch deleted unmerged                        | Restorable for `DOCUMENT_BRANCH_GRACE_DAYS`, then purged with its notes |
| **Purged**    | `DOCUMENT_BRANCH_GRACE_DAYS` after it was discarded, at the daily clean-up, as the Trash's | Gone; its Timeline event says "Discarded <name>" and keeps who and when |

- **Discarded branches** are listed under **Discarded** at the bottom of the switcher with the days left, as the
  Trash shows them, and **Restore** reopens one as it was. A restore whose name an open branch has taken since is
  refused, naming it.
- **A merged branch's name is free again.** Changes arriving later under the same name (a git branch that keeps
  receiving commits after its pull request merged) start a new branch of that name, from main as the merge left it.
- **A merge leaving later edits behind** (edits made on the branch after the revision git merged) keeps the branch
  open with only those edits, saying "Merged up to <when>; N later changes not merged".
- **A document moved to the Trash** takes its branches with it; restored, it brings them back as they were. A
  purged document purges its branches.

## Agents

- The CLI's document commands and changesets take `--branch <name>`; the MCP server's tools take `branch`. Without
  it they act on main, except inside a linked work tree, where they act on the branch bound to the work tree's git
  branch, so an agent working on `feature-x` edits `feature-x` whichever way it writes
  ([CLI](../015-api/cli.md#commands)).
- A write naming a branch that does not exist starts it only inside a linked work tree, where the git branch already
  names it; elsewhere it is refused, "No branch <name> on <document>: `--create-branch` starts it from main", so a
  typo never starts a stray branch.
- `document branches <doc>` lists a document's open and discarded branches; `document merge <doc> --branch <name>`
  merges one, printing every unmerged change; `document discard <doc> --branch <name>` discards one.
- Views and diffs read a branch as they read main; `tab diff --branch <name>` is Compare with main as text.

## Share roles

| Role            | May                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Editor**      | See every branch; start, edit, compare, update, merge, discard and restore branches             |
| **Participant** | Main only: a participant link opens main, and the switcher and branch addresses are not offered |
| **Viewer**      | Main only, as a participant                                                                     |

A branch holds work not yet merged; a link handed out to read or take part shows what the document is, never what it
may become. A branch address opened through a participant or viewer link opens main.

## Where branches do not exist

- **Documents in This Browser** and [offline documents](offline-mode.md) have no branches: **Branch** says "Save to
  LiveDoc to branch this document". Taking a document with open branches offline is refused, naming them.
- The [Google Drive mirror](../022-drive-mirror/drive-mirror.md) and [Community](../025-community/community.md)
  publish main only.

## Usage

A branch counts towards its owner's storage by what it holds beyond main; an open branch also keeps its branch point,
which counts until it closes ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)).

## Limits

| Constant                         | Value | Why                                                                                                |
| -------------------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| `DOCUMENT_BRANCHES_OPEN_MAX`     | 50    | A switcher a person can scan; a busy repository's open pull requests on one page stay under it     |
| `DOCUMENT_BRANCH_NAME_MAX_BYTES` | 255   | A name a file system holds as one path component; git's longest practical branch names fit         |
| `DOCUMENT_BRANCH_GRACE_DAYS`     | 30    | The Trash's own grace ([Trash](../013-workspace/trash.md)), so nothing deleted keeps a shorter one |

Starting a branch past `DOCUMENT_BRANCHES_OPEN_MAX` is refused with "<document> has 50 open branches: merge or
discard one first". A git branch's first change past it is refused for that document only, and reported by the sync.

## Observability and telemetry

- Fingerprints, with the document id and a hash of the branch name, never content or the name itself:
  `[branch] started` (with how: hand, git, agent), `[branch] merged`, `[branch] merge-retried`,
  `[branch] unmerged-change` (with the content kind), `[branch] updated-from-main`, `[branch] discarded`,
  `[branch] restored`, `[branch] purged`, `[branch] renamed`, `[branch] refused` (with the rule).
- Telemetry: `Document · Branched` with the type `Hand`, `Git` or `Agent`; `Document · Merged` with `Hand` or `Git`;
  `Document · Discarded` with `Hand` or `Git`. `Branched`, `Merged` and `Discarded` join the closed actions enum.

## Non-goals

- **A history of every revision as named versions.** Branches are for work in progress; a document's history is its
  Timeline.
- **Merging two documents.** A merge is between branches of one document.
- **Branches of a folder.** A folder has no branch; each document in it branches on its own, and a git branch that
  changes many documents lists their branches together by name.
