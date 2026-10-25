# Committed files

**Status: specified.** Nothing is built.

A repository chooses which of the files a link writes are committed to git. Small files are committed, so GitHub,
clones and CI read them; large ones are **kept out of git**: still written into the work tree, where people, agents
and editors read them as before, but never in a commit. The rule is per link, with an override per file in LiveDoc.

## Domain language

| Term                | Means                                                                                  | Never called                                                   |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **kept out of git** | Written into the work tree by the sync, listed in the managed section, never committed | ignored (that is the link's own `ignore`), excluded, untracked |
| **managed section** | The lines of the link dir's `.gitignore` between `# livedoc:begin` and `# livedoc:end` | LiveDoc block, generated ignore                                |

## The rule

```toml
[files]
commit_max_bytes = 1048576      # files up to this size are committed; default 1 MB
commit_warn_bytes = 209715200   # warn when the committed files pass this total; default 200 MB
```

- **By size**: a file the link writes is committed when it is at most `commit_max_bytes`, and kept out of git when it
  is larger. The size is judged at every write, so a file that grows past it is kept out from then on and one that
  shrinks under it is committed again; each switch is reported.
- **By choice**: a file document's or page's menu in LiveDoc offers **Commit to git** and **Keep out of git** while
  the document is covered by a link at `files`, and **Follow the size rule** once either is chosen. The choice is the
  document's, on every branch and in every link that covers it.
- **Never kept out**: the link file, the [sync records](native-files.md#the-sync-record), `INDEX.md`, outline files and
  renders. They are what makes a clone readable, and they are small.
- Every page is committed by the default rule: a page holds at most `MARKDOWN_TEXT_MAX_BYTES`, which is the default
  `commit_max_bytes` ([Markdown tab](../031-markdown/markdown-tab.md#limits)).
- `commit_max_bytes` above `FILE_TAB_MAX_BYTES` or below 1 is refused by name, as any unknown or invalid key is.

## The managed section

A file kept out of git is listed, by its path from the link's `dir`, in the **managed section** of the `.gitignore` at
the link's `dir`:

```gitignore
node_modules/
# livedoc:begin (written by livedoc sync; edit the documents, not these lines)
/media/demo-recording.mp4
/datasets/2026-survey.csv
# livedoc:end
```

- **Lines outside it are the repository's own** and never touched. The section is appended at the end of the file
  the first time a file is kept out, so its lines are read last and win; a section someone moved stays where it is.
- Each entry is anchored with a leading `/` and escapes what `.gitignore` reads as a pattern (`*`, `?`, `[`, `!`, `#`,
  a trailing space), so it names exactly one file. Entries are sorted, so the same choices write the same bytes.
- A section left empty is removed with its markers; a `.gitignore` that held nothing else is removed.
- **A line elsewhere that re-includes a kept-out file** (`!media/*.mp4` after the section) is found with
  `git check-ignore` at each sync; the file is reported, naming the line, and treated as committed until the line
  goes.
- **A file the repository's own `.gitignore` already ignores** is kept out by the repository's choice: the sync still
  writes it, adds no entry, and `link status` lists it as "kept out by .gitignore:<line>".
- **The managed section on a branch** is the git branch's own: each sync writes the section for the files it writes,
  so a git merge of two sections conflicts only when both changed the same entries, and `sync --resolve .gitignore`
  regenerates the section, leaving every other line as git merged it.

## Switching

- **To kept out**: the sync adds the entry and removes the file from the index (`git rm --cached`), so the next commit
  stops carrying it, and leaves it in the work tree. **History keeps every version already committed**; LiveDoc
  never rewrites git history. Removing them is the repository's own decision and tool (`git filter-repo`), and the
  menu item says so: "Earlier commits keep their copies of this file."
- **To committed**: the sync removes the entry and stages the file, so the next commit carries it.
- Both land in the next commit, as any sync's files do, and follow the [hooks](branch-binding.md#the-hooks).

## A kept-out file in a clone

- **A fresh clone** has no kept-out file: its record says it is kept out, so its absence is never a delete. The first
  sync writes it.
- **Deleting a kept-out file** from the work tree is not a delete either: the sync writes it again and says "<path> is
  kept out of git: delete the document in LiveDoc or with `livedoc document rm`".
- **Editing a kept-out file** folds back as any edit, into the document branch of the work tree's git branch.
- **CI and GitHub never see it.** `link status` in CI lists kept-out files as not checked.

## Git LFS

- **Respected, never required.** A path the repository's `.gitattributes` gives `filter=lfs` is written as its real
  bytes; git's own filter stores it in LFS when it is committed. LiveDoc never writes `.gitattributes` for LFS.
- **A clone without Git LFS** holds pointer files at those paths. A pointer is neither an edit nor a delete: it is
  reported, "Git LFS is not installed: <path> holds a pointer", and the sync leaves the file and its document as they
  are.
- Size counts the real bytes: an LFS-tracked file over `commit_max_bytes` is kept out like any other, unless chosen
  **Commit to git**.

## What the link shows

- `link status` and the link's panel in LiveDoc show **"Committed: <size> · Kept out: <size>"**, with each kept-out
  file's path, size and why (size, choice, or the repository's `.gitignore`).
- **Past `commit_warn_bytes`** of committed files, both warn once per sync: "<size> of files are committed. Large
  repositories clone slowly: keep large files out of git, or raise `commit_warn_bytes`." Nothing is refused.
- [Unlinking](repository-link.md#unlinking-and-re-linking) lists the kept-out files and offers to commit them or leave
  them on disk.

## Observability and telemetry

- Fingerprints, with the document id and a path hash, never names: `[files] kept-out` (with the reason),
  `[files] committed-again`, `[files] reincluded-by-line`, `[files] lfs-pointer`, `[files] warn-size`.
- Telemetry: `Document · Changed · KeptOutOfGit`, `CommittedToGit` and `FollowSizeRule` for the menu choices.
