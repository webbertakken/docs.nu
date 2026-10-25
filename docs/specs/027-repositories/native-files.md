# Native files

**Status: specified.** Nothing is built.

A **native file** is a document in its own file form: a page as its `.md` file, a file document as its bytes. A
[repository link](repository-link.md) at the `files` level writes every covered page and file document as a native
file, so whoever reads the repository with `rg`, `cat` or GitHub reads exactly what people edit in livedocs, and it
folds the changes made to those files back in.

Everything in [Repository link](repository-link.md) holds here; this spec adds what a file that _is_ the document
asks for. livedocs stays the source of truth: a native file is a snapshot at a recorded revision, and a change made
to it is a proposal that reaches livedocs as a [changeset](../024-agents/agent-changesets.md), or does not count.

This spec names things as livedocs's command line does: the command `livedocs`, the link file `livedocs.toml`, the
mirror file `<slug>.livedoc.json`. [Repository link](repository-link.md) keeps livediagram's spelling of the same
names until the rename reaches it.

## What a link writes

At the `files` level, per covered document:

| Document                                                     | Files                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A page: one [markdown tab](../031-markdown/markdown-tab.md)  | `<name>.md` (or `.markdown`, as it was adopted): the text's bytes                                 |
| A file document: one [file tab](../006-document/file-tab.md) | `<name>.<extension>`: its bytes, with the executable bit when it carries one                      |
| Any other document                                           | The mirror file and the outline file ([Repository link](repository-link.md#mirror-levels))        |
| A page or file document that has gained tabs                 | Its native file for its **native tab**, plus a mirror file and an outline file for the other tabs |
| A document a page embeds as an image                         | Also `<slug>.livedoc.svg`: its first tab drawn, so the page shows it on GitHub too                |

- **The native tab** is the tab a native file holds: the one it was made from, or the first when the document was
  created in livedocs.
  Its id is kept in the [sync record](#the-sync-record), so reordering tabs never moves the file.
- **The outline file** is named after its mirror file, `<slug>.livedoc.md`, so it never takes a page's name.
- **A render** (`.livedoc.svg`) is written while any covered page embeds the document
  (`![Architecture](architecture.livedoc.svg)`) and removed when none does. Its bytes are deterministic, like every
  file a link writes.
- **Generated files are never documents.** Mirror files, outline files, renders, `INDEX.md` and the sync record are
  never adopted as pages; an edit made to an outline or a render is reported as not sent and overwritten at their next
  write.
- `INDEX.md` is not written where a page's file would take its path, compared case-insensitively: a wiki's
  [entry page](../032-wikis/wiki.md#the-entry-page) holds that place.

## Names and paths

At the `files` level the directories under the link's `dir` are the folders of its covered folder: a folder is a
directory of the same name, and a native file's path is its folders' names, then the document's name and its
extension.

- **The path follows the name.** Renaming or moving a page or file document in livedocs moves its file at the next
  sync (`git mv` inside a git work tree). A mirror file keeps its slug when its document is renamed; a native file
  cannot, because the file is the page, and the [links](../032-wikis/links.md) between pages are paths.
- **A name is a file name.** In a folder a link covers at `files`, a page's, file document's or folder's name must
  be a portable file name: none of `/ \ : * ? " < > |`, no control character, not ending in a space or a dot, not a name Windows
  reserves (`CON`, `NUL`, `COM1`, ...). A rename that breaks this is refused with "“<name>” can’t be a file name in
  <folder>, which syncs to a repository: remove <character>."
- **Names that predate the link.** A page, file document or folder already named otherwise when the link arrives is
  held back from the sync and reported with the character to remove; nothing is renamed for it.
- **Siblings differ.** Within such a folder no two documents with the same extension, and no two folders, share a
  name compared case-insensitively and after Unicode NFC, so a clone on macOS or Windows never folds two files into
  one. A rename or a new document that would collide is refused, naming the other.
- **Names from files keep their length.** A document named after a file keeps the file's name whole, up to 255 bytes
  ([Name length](../006-document/name-length.md#names-from-files)).
- **Empty folders write nothing**: git keeps no empty directories. An empty directory in the work tree creates no
  folder.
- A move never lands on a file livedocs did not write ([Repository link](repository-link.md#the-mirror-file)).

## The sync record

A native file cannot carry its own sync data without changing its bytes, so a link at `files` keeps
**`livedocs-sync.jsonl`** beside its link file, committed. One line per native file, sorted by path:

```text
{"path":"tools/pm2.md","document":"doc_3h9x2a","tab":"0b34","rev":41,"hash":"sha256:9f2c..."}
```

- It holds no time, so a sync at unchanged revisions writes the same bytes, as a mirror file does.
- `hash` is over the file's bytes. A file whose hash matches its line is unchanged since the sync wrote it.
- **A missing or partial record is rebuilt**, never trusted blindly: a file at the path of a covered document is that
  document, and its base is found as for any file ([Folding a file back](#a-page)).
- **In git** the record merges by line through the merge driver: a path only one side changed takes that side; a path
  both changed takes the higher revision, and the merge of the file itself decides the rest ([Git](#git)).

## Sync states

A native file is in one of the [sync states](repository-link.md#sync-states), read from its record line, its bytes
and the document now. Beyond them:

| State       | Means                                                                              | A sync                                             |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| `local-new` | A file under `dir` with no record line, at no covered document's path, not ignored | Creates the document ([Adopting](#adopting-files)) |
| `deleted`   | A recorded file is missing from the work tree, and no rename explains it           | See [Deletes](#deletes)                            |
| `moved`     | A recorded file is missing and an unrecorded file is its rename                    | See [Renames and moves](#renames-and-moves)        |

### Adopting files

- A `local-new` file becomes a document in the folder its directory names; missing folders are created.
- `.md` and `.markdown` files become pages when they read as text
  ([Markdown tab](../031-markdown/markdown-tab.md#reading-a-file)); everything else becomes a file document.
- **Ignored**, and reported once per sync where it matters: dotfiles and dot directories (`.git`, `.github`), files
  git ignores, symbolic links (never followed), files over `FILE_TAB_MAX_BYTES`, Git LFS pointer files, and paths
  matching the link file's `[mirror] ignore` globs.

```toml
[mirror]
level = "files"
dir = "docs"
ignore = ["drafts/**", "*.tmp"]   # never adopted, never written
```

## Folding a file back

### A page

1. **The base is the snapshot the file is nearest to.** Among the snapshots the sync can reach (its kept bases, the
   revision in the record, and inside git the file's own history) the base is the one fewest characters away from the
   file; a tie takes the newest. An agent that read a page, waited, and wrote the whole file back started from an
   older snapshot; merging it from the newest would quietly undo everything that arrived in between. With no snapshot
   to reach (a fresh clone of a squashed history, a lost record), the merge is
   [baseless](repository-link.md#merging): livedocs's text stands, and every stretch where the file differs is a lost
   local value (below).
2. **A three-way merge** of the base, the file and the page as livedocs holds it now: by lines, then by words inside
   a line both sides changed. A change only one side made is taken; the same change made on both sides is taken once.
3. **A stretch both sides changed differently** keeps livedocs's text. The file's version of that stretch is a
   [lost local value](repository-link.md#merging): in the sync report, and as a margin note on the stretch, "Not
   applied from <path>: <the file's text>", by the person syncing, so whoever reads the page sees it and settles it.
4. **The send** is one `patch` changeset: the edits that turn the revision the merge read into the merged text, based
   on that revision ([Markdown tab](../031-markdown/markdown-tab.md#writing)). The document's room maps them onto the
   characters as they stood at that revision, so they merge with anything typed since by character, as a
   reconnecting editor's edits do ([Markdown tab](../031-markdown/markdown-tab.md#how-the-merge-works)). A revision the room no longer keeps answers
   `412 stale_tab`; the sync re-reads and re-merges, up to `SYNC_MERGE_ATTEMPTS` times.
5. The changeset is credited to the person or token syncing, with the summary "From <path>", so people with the page
   open see the file's edit arrive under a name.
6. The sync then writes the page's new bytes to the file, and its record line.

### A file document

A file document is changed whole ([File tab](../006-document/file-tab.md#changing-it)).

| Local file | livedocs since the base | A sync                                                                                  |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------- |
| Changed    | Unchanged               | Replaces the bytes                                                                      |
| Unchanged  | Changed                 | Writes the new bytes                                                                    |
| Changed    | Changed                 | A **conflict**: nothing is written or sent; reported, naming the file and both ways out |

A conflicted file document is settled with `livedocs sync --take file <path>` (the file's bytes
replace livedocs's) or `--take livedocs <path>` (livedocs's bytes replace the file). The bytes that lose stay
restorable ([File tab](../006-document/file-tab.md#changing-it)), or in git's history.

## Renames and moves

- **In livedocs.** The next sync moves the file and its record line. [Links](../032-wikis/links.md#renames) to it are
  rewritten in the pages that hold them, as edits that sync like any other.
- **In the repository.** A recorded file missing from the work tree and an unrecorded file found in the same sync are
  one **move** when their bytes are equal, or, for pages, when they are at least `SYNC_RENAME_SIMILARITY` alike (as
  git judges a rename). The document is renamed and moved to the folder of the new path, and any change of content is
  folded back as above. Of several candidates the most alike is taken; a tie is no move.
- **Both sides.** A document renamed differently on each side keeps livedocs's name; the file is moved to it, and the
  repository's name is reported as not applied.
- **Case only.** A rename that changes only letter case moves through a temporary name, so case-insensitive file
  systems see it.

## Deletes

- **Deleted in livedocs** (moved to the Trash, or purged): the file is `gone` and removed; git history keeps it. A
  file holding a change nobody has sent stays, and is refused, never removed
  ([Repository link](repository-link.md#sync-states)). Restored from the Trash, the document is written again.
- **Deleted in the repository** (an agent's `git rm`, a file removed by hand): the document moves to the
  [Trash](../013-workspace/trash.md), recoverable for 30 days, and the record drops its line. An edit outranks a
  delete: a file deleted while livedocs changed its document since the file's base is written again, and the sync
  says so.
- **A folder** whose documents have all gone, either way, goes with them.

## While people and agents edit

A page has two front doors, the document and its file, and both stay one page:

- **With `livedocs sync --watch` running**, a change in either place reaches the other once it settles: a burst of
  typing in livedocs, or `SYNC_LOCAL_SETTLE_MS` of quiet on the file. A sync never writes over a file edited while it
  runs ([Repository link](repository-link.md#commands)).
- **Without it**, files catch up at the next sync: one run by hand, the pre-commit hook, or CI asking `link status`.
- **Edits from a fresh read are always safe.** An agent's exact-text edit fails cleanly when the words it looked for
  have moved, and it reads again.
- **A whole-file write from a stale read loses nothing**: it merges from the snapshot it was nearest to
  ([Folding a file back](#a-page)).
- **A changeset to a covered page refreshes its file at once.** When the command line writes a page through a
  changeset, the file is rewritten right away if it is unchanged since its record, so `rg` finds the agent's own
  words without waiting; a file changed meanwhile waits for the next sync's merge.
- **Live typing and a file edit at once** merge; neither replaces the other.

## Git

The [hooks and the merge driver](repository-link.md#git) apply to native files, on the link's live branch only
([Branches](#branches)).

- **A page git left conflicted** (markers in the text) is refused, naming `livedocs sync --resolve <file>`. Resolve
  reads git's three versions and sends each side's change from the common base as its own proposal, so both
  branches' words arrive, then writes the merged page and stages it.
- **The record** merges through the driver ([The sync record](#the-sync-record)).
- **Commits and pushes are the link's choice**, `[git] commit` in the link file: `none` writes files only and leaves
  commits to people and the hook; `commit` commits each settled sync; `push` commits and pushes it. `link init`
  suggests `push` for a whole-repository wiki, which nobody else commits to, and `none` otherwise. Whatever the
  setting, a sync never force-pushes, never rewrites history, commits only files under the link's `dir` and the
  record, refuses partial staging as the hook does, and authors a commit as the work tree's own git identity. A commit message names the
  pages by path with their revisions, never the names or emails of the people who edited them in livedocs: a public
  repository would publish them.
- **A rejected push** (the remote moved): fetch, rebase the sync's commit onto it, sync once more, push. Still
  rejected, it is reported and retried at the next sync; the commit stays local, nothing is lost.

## Branches

A link exchanges with **one branch: its live branch**, the repository's default branch unless the link file names
another (`[git] branch`). livedocs holds one version of a page; every other branch is plain git.

- **On the live branch, a sync runs both ways**, as above, but only from a clean footing: the work tree is on the live
  branch (not detached), no rebase, merge, cherry-pick or revert is in progress, no file is conflicted, and the commit
  the link last synced at (kept in the local sync state) is an ancestor of `HEAD`. Anything else is refused with the
  state and its fix, and changes nothing.
- **On any other branch, a sync does nothing**: it neither sends nor writes, and says "On <branch>: livedocs syncs
  <live branch>". The hook lets the commit through. A page edited on a branch is an ordinary change in git.
- **A branch's changes go live when it merges** into the live branch: the merge (its pre-merge-commit hook, or the
  next sync there) finds the files changed and folds them back from their base, merging with whatever livedocs gained
  meanwhile ([Folding a file back](#a-page)). A documentation change in a pull request goes live with the code it
  describes; an abandoned branch never reaches livedocs.
- **livedocs's changes reach a branch through git**: they land on the live branch (as `commit` says), and a branch
  takes them as it takes any change there, by merging or rebasing. A page changed on both sides conflicts like any
  file; `livedocs sync --resolve <file>` merges both sides from their common base by character, so no words are lost.
- **History rewritten on the live branch** (the last synced commit is no longer an ancestor of `HEAD`): refused.
  `livedocs sync --adopt-head` takes the work tree as one new commit: pages that differ from their record fold back as
  edits, missing files go to the Trash, as in any sync, and a dry run lists both first.
- **Who syncs the live branch**: any checkout on it, a person's or an agent's `--watch`, or a CI job on the live branch
  after a merge.

## Offline

- **The command line offline**: local edits wait in the files; snapshots stay as they are; the hook lets the commit
  through ([Repository link](repository-link.md#the-hooks)). The next sync folds them back from their nearest base.
- **A page edited offline in the browser** merges when the browser reconnects
  ([Markdown tab](../031-markdown/markdown-tab.md#collaboration)); the next sync writes the result.

## Limits

| Constant                 | Value | Why                                                                                      |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------- |
| `SYNC_RENAME_SIMILARITY` | 0.5   | Git's own rename threshold, so the sync and `git log --follow` agree on what a rename is |

How many revisions a room keeps for a `patch` is the markdown tab's `MARKDOWN_REVISIONS_KEPT`
([Markdown tab](../031-markdown/markdown-tab.md#limits)).

## Observability and telemetry

- Fingerprints, each with the document id and path hash, never content: `[sync] adopted`, `[sync] ignored`,
  `[sync] moved`, `[sync] deleted`, `[sync] nearest-base`, `[sync] patched`, `[sync] lost-local-value`,
  `[sync] file-conflict`, `[sync] taken`, `[sync] committed`, `[sync] pushed`, `[sync] push-rejected`.
- Telemetry: category `Cli`, action `Used`, type `SyncTake` for `--take`; the rest counts as `Sync`.
