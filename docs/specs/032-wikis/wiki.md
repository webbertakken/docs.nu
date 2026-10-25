# Wiki

**Status: specified.** Nothing is built.

A **wiki** is a folder of pages written to be read together: opened from an entry page, linked page to page, and
searched as one. **Wikis are folders** ([Purpose](../001-project-vision/purpose.md#what-it-is)):

- A **global wiki** holds knowledge that belongs to no one project, and syncs to a repository of its own.
- A **project wiki** holds a project's own knowledge, and syncs to a path inside the project's repository.

Both are edited, linked and searched the same way. Global and project say what a wiki is for and where it syncs;
LiveDoc treats them alike, and a person may keep any number of each.

## Domain language

| Term             | Means                                                                              | Never called                            |
| ---------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| **wiki**         | A folder marked as a wiki, with everything below it                                | space, notebook, vault, knowledge base  |
| **global wiki**  | A wiki for knowledge across projects, synced to a repository of its own            | personal wiki, main wiki                |
| **project wiki** | A wiki for one project, synced to a path inside that project's repository          | docs folder, repo wiki                  |
| **section**      | A folder inside a wiki: one of its parts                                           | sub-wiki, chapter                       |
| **page**         | A document whose single tab is a [markdown tab](../031-markdown/markdown-tab.md)   | note, article, entry                    |
| **entry page**   | The page a wiki opens on, linking out to the rest                                  | home page, index (that is `INDEX.md`'s) |
| **sync target**  | Where a wiki's repository link writes it: a whole repository, or a path inside one | remote, destination, mirror             |
| **backlink**     | A link to a page, seen from the page it points at                                  | reference, mention                      |
| **orphan page**  | A page no other page of its wiki links to                                          | lost page, unlinked page                |
| **wiki health**  | A wiki's orphan pages, broken links and pages missing from its entry page          | lint, audit, report                     |

## What makes a folder a wiki

**A folder is a wiki when it is marked as one**, whether or not it syncs anywhere, so a person without a repository keeps a wiki too.

- **Make this a wiki** is in a folder's menu, for people who may edit the folder; **Stop being a wiki** undoes it.
  Neither changes a document: unmarking keeps every page, file and link exactly as it is.
- A wiki is a personal or team folder and everything below it. Its subfolders are its **sections**, never wikis of
  their own: marking a folder inside a wiki, or a folder that holds one, is refused with "“<folder>” is inside the
  wiki “<wiki>”" (or "holds the wiki").
- A wiki holds **any document**: pages, [file documents](../006-document/file-tab.md), diagrams, boards, sheets. A
  document moved into the folder joins the wiki; moved out, it leaves, and links to it are kept valid
  ([Links](links.md#renames)).
- A wiki's documents are saved in LiveDoc, never only in This Browser, so other people and the command line reach
  them. Saving a wiki's page to This Browser is not offered.
- In a wiki, the names of pages, file documents and sections are file names, unique among their siblings, as in any
  folder a link writes native files for ([Native files](../027-repositories/native-files.md#names-and-paths)), whether or not the wiki syncs
  yet, so linking a repository later never has to rename anything.

## Sync target

A wiki syncs through an ordinary [repository link](../027-repositories/repository-link.md) at the `files` level, so
its pages arrive as [native files](../027-repositories/native-files.md). There is no second sync.

| Target                                  | Link file                                              | `dir`                                |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| None                                    | None: the wiki lives in LiveDoc only                   |                                      |
| A whole repository (a global wiki)      | At the repository's root                               | Where the pages live, such as `docs` |
| A path in a repository (a project wiki) | At the repository's root, or a package's in a monorepo | The wiki's path, such as `docs/wiki` |

- `livedoc link init --folder <wiki>` sets `level = "files"` when the folder is a wiki, and says so; any other level
  is refused for a wiki, which is nothing without its files.
- **One wiki may sync to several targets.** Each link keeps its own snapshot and records, as two links covering one
  document always do.
- **Every git branch of a target has its own pages.** A checkout on a git branch syncs with the wiki's document
  branches of that name, and the main git branch with the wiki itself, so a pull request's page changes are a branch
  people edit live and merge with the code ([Branch binding](../027-repositories/branch-binding.md)).

### Bringing an existing wiki in

A repository that already holds a wiki (a `docs/` tree of markdown, such as a global wiki kept by agents) comes in
through the same link:

1. Make an empty folder a wiki; `livedoc link init --folder <wiki> --dir docs` in the repository.
2. `livedoc sync --dry-run` lists every file it would adopt as a page or file document, every file it would ignore
   and why, and every name it would refuse ([Native files](../027-repositories/native-files.md#adopting-files)).
3. `livedoc sync` adopts them. A large first sync writes the record as it goes, so an interrupted one resumes where
   it stopped and never creates a document twice.
4. The files' bytes are unchanged by adoption: the first commit after it adds only the link file and the sync records.

## What is mirrored

| In LiveDoc                                    | In the repository                                                |
| --------------------------------------------- | ---------------------------------------------------------------- |
| A page                                        | Its `.md` file, byte for byte                                    |
| A file document                               | Its file, byte for byte, with its executable bit                 |
| A diagram, board, sheet or any other document | Its mirror file and outline file; a render when a page embeds it |
| A section (subfolder)                         | A directory of the same name                                     |
| The wiki's structure: names, folders, moves   | Paths                                                            |

Files larger than the link's `commit_max_bytes`, or chosen **Keep out of git**, are written into the checkout and
kept out of commits ([Committed files](../027-repositories/committed-files.md)); their links work in the checkout as
any other.

**Never mirrored**: margin notes and comments, presence, share links and roles, tags, favourites, the Trash, the
wiki mark itself, empty sections, documents the link ignores, and the merge state. A repository's history is git's;
LiveDoc never writes its own history into files.

## The entry page

Every wiki has one entry page: its root's page named `index`, else `README`, else the first root page by name, until
an editor picks another (**Set as entry page**). Opening the wiki opens it, with the wiki's sections and pages beside
it.

**The entry page stays hand-written**, because its summaries carry judgement a generator cannot, and LiveDoc keeps
it honest:

- A page the entry page does not link to is **not in the entry page**, listed in the [wiki health](#wiki-health).
- **Add to the entry page** writes one line, `- [<title>](<path>): <summary>`, at the end of the section whose
  heading names the page's folder, or at the end of the page when none does. The title is the page's
  ([Markdown tab](../031-markdown/markdown-tab.md#the-rendered-page)); the summary is the front matter's
  `description`, else the first sentence of the page's first paragraph. It is an ordinary edit, by whoever pressed it.
- A link on the entry page whose page is gone is a [broken link](links.md#broken-links), offered **Remove the line**.

## Wiki health

The wiki's links are known to LiveDoc, read from every page as it is saved, so its health is always current and
never needs a scan of files.

- **Orphan pages**: pages no other page of the wiki links to. The entry page is never one. A page linked only from
  outside the wiki is an orphan inside it.
- **Broken links**: links that resolve to nothing ([Links](links.md#broken-links)).
- **Not in the entry page**: as above.

Where it shows:

- **On the wiki**: its header carries the counts ("2 orphan pages · 1 broken link"), which open the **Health** panel,
  one row per finding with its fix: **Add to the entry page**, **Link from…** (opens a page picker and inserts a link
  at its end), **Fix the link** (offers the nearest page by name), **Remove the line**.
- **On a page**: an orphan page says "No page links here" under its title, with **Link from…**; a broken link is drawn
  struck through, with why on hover and focus.
- **For agents and CI**: `livedoc wiki check [<wiki>] [--fail-on orphans,broken,unlisted]` prints one line per
  finding, `path:line: kind: detail`, and exits 1 when a finding of a named kind exists, 0 otherwise. Run in a synced
  checkout, it also reports links that leave the wiki into the repository and no longer resolve there
  ([Links](links.md#links-out-of-the-wiki)).

A healthy wiki shows nothing: no counts, no panel entry point beyond the menu.

## Search

- **In a wiki**, the Explorer's search field searches that wiki: page names, titles and text, and the outlines of
  its other documents. Each result shows the page, its section path and the matching line with the words marked;
  titles rank above text.
- **Everywhere**, Search results match page text as well as names, across every document the reader can open. The
  lens gains a **Wiki** dimension: `wiki:<name>` narrows to one wiki, `wiki:any` to every wiki the reader can open
  ([Explorer filters](../013-workspace/explorer-filters.md)).
- **From the command line and the MCP server**, `livedoc search <words> [--wiki <wiki>|--all-wikis]` prints
  `path:line: text`, as `rg` does, so an agent searches a wiki it has no checkout of the way it searches one it has.
- Search reads only what the reader may open, and indexes text as pages are saved. Front matter is searched; margin
  notes are not.

## Share roles

A wiki's roles are its folder's ([Share roles](../013-workspace/share-roles.md)).

| Role            | May                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Everything a Participant may; edit, add, rename, move and delete pages; mark and unmark the wiki; set the entry page; apply health fixes |
| **Participant** | Read, search and follow links; see the wiki health; write and reply to margin notes                                                      |
| **Viewer**      | Read, search and follow links; see the wiki health                                                                                       |

Linking a repository is the command line's, with the linking person's own access
([Repository link](../027-repositories/repository-link.md#who-may-sync)).

## Privacy

**A wiki synced to a public repository is public**: every page, file, name and path in it, and every change, the
moment the sync pushes or someone else does. LiveDoc makes that visible, without second-guessing the repository's
owner:

- **`link init` asks to confirm** when the repository is public: "Everything in “<wiki>” will be public on <repository>.
  Continue?" Declined, nothing is linked.
- **The wiki is badged Public** in LiveDoc while a repository it syncs to is public: on the wiki, in the Explorer,
  and on each of its pages beside the title, with the repository named on hover and focus. Whoever writes a page sees
  that it is published.
- **A repository that turns public later** is found at the next sync, which badges the wiki and says so once; a
  repository that turns private drops the badge.
- Whether a repository is public is read from its host when the link's `[repository] web` names one; a repository
  LiveDoc cannot ask about is treated as public.

## Observability and telemetry

- Fingerprints, with folder and document ids, never names or text: `[wiki] marked`, `[wiki] unmarked`,
  `[wiki] nested-refused`, `[wiki] entry-set`, `[wiki] health` (with the counts), `[wiki] fix-applied` (with the fix),
  `[search] wiki-query` (with the scope and the result count, never the words).
- Telemetry: `Folder · Changed · WikiMarked` and `WikiUnmarked`; `UI · Opened · WikiHealth`; `Search · Searched ·
WikiText`; `Cli · Used · WikiCheck` and `Search`.

## Non-goals

- **Publishing a wiki as a website.** A wiki is read in LiveDoc and in its repository; a public site of it is a
  separate decision.
- **A wiki's own history.** Each document's history is LiveDoc's; the repository's is git's.
- **Wiki-link syntax** (`[[Page]]`) as a link: it is kept as text and drawn as text ([Links](links.md)).
