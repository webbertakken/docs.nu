# Links

**Status: specified.** Nothing is built.

Pages link to each other with **ordinary markdown links**, so one text works in LiveDoc, on GitHub and in a
checkout read with `rg`. LiveDoc resolves a link when it draws the page and when it saves it; it never rewrites a
link's text, except to follow a rename ([Renames](#renames)).

## Domain language

| Term                 | Means                                                                                                    | Never called                |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| **link**             | A markdown link or image in a page's text: `[text](target)`, `![alt](target)`, or a reference definition | reference, wikilink         |
| **target**           | What a link points at: a document, a section, a heading of a page, or an address outside                 | destination, href (in copy) |
| **relative link**    | A link whose target is a path from the page's own folder                                                 | local link                  |
| **document address** | A document's permanent address, `https://<host>/document/<document id>`                                  | permalink, share link       |
| **broken link**      | A link whose target LiveDoc cannot find                                                                  | dead link, 404              |

## Link forms

| From → to                                | Target, as written in `[text](target)`               | Resolves to                                                            |
| ---------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| A page → a page of the same wiki         | `../tools/pm2.md`                                    | The page at that path                                                  |
| A page → a heading                       | `../tools/pm2.md#ports`, or `#ports` within the page | The heading whose slug matches, as GitHub slugs it                     |
| A page → a file document                 | `setup.sh`; `img/flow.png` in an image, `![Flow](…)` | The file document; an image is drawn                                   |
| A page → a diagram or other document     | `architecture.livedoc.md`, its outline file          | The document, opened on its first tab; `#<tab name>` opens that tab    |
| A page → a diagram, drawn in the page    | `architecture.livedoc.svg` in an image, its render   | The document's first tab, drawn live                                   |
| A page → a section                       | `../tools/`                                          | The section, opened on its `index` or `README` page when it has one    |
| A page → a page of another wiki          | `../../../wiki/docs/tools/pm2.md`                    | The page, across checkouts ([Links across wikis](#links-across-wikis)) |
| A page → the repository outside the wiki | `../../apps/cli/src/input.ts`                        | [Links out of the wiki](#links-out-of-the-wiki)                        |
| A page → the web                         | `https://yjs.dev`                                    | The address, opened in a new browser tab                               |

- Relative links are written to the **native file** paths a sync writes
  ([Native files](../027-repositories/native-files.md#what-a-link-writes)), so a link that works in LiveDoc works in
  the repository, and the other way round. A wiki that has never synced uses the same paths.
- **On a branch**, a link opens its target's [document branch](../006-document/document-branches.md) of the same
  name where one exists, and its main otherwise, so a git branch's pages link to each other as that git branch holds
  them.
- **A path starting with `/`** is relative to the repository's root, as GitHub reads it. In LiveDoc it resolves
  inside the wiki when it lands under the link's `dir`, and as a link out otherwise.
- **Spelling.** `my%20page.md`, `<my page.md>` and `./my page.md` resolve alike. Reference-style links resolve as
  inline ones.
- **Case.** A target matches exactly. One that matches only when compared case-insensitively is a broken link with
  **Fix the case** offered: Linux checkouts and GitHub are case-sensitive, so it is broken there.
- **Wiki-link syntax** (`[[PM2]]`) is text, drawn as text; it is not a link.

## Links across wikis

Wiki files stay plain, and keep working on a machine without LiveDoc. So a link from one wiki to another is a
**relative path** too, written between the two wikis' files as their repositories are checked out **side by side**:
every repository in one parent folder, each in a folder named after the repository (`~/Repositories/wiki`,
`~/Repositories/spinner`).

- LiveDoc writes and resolves it from each wiki's sync target: the repository's name and the link's `dir`. A wiki
  without a sync target counts as a repository named after the wiki, so a link to it is valid once it syncs under
  that name, and is rewritten when it syncs under another.
- **In LiveDoc** it resolves through the sync targets, whatever a machine's layout. **In a checkout** it resolves
  where the repositories sit side by side, so `rg`, an editor and an agent follow it. **On GitHub** it does not: it
  climbs out of the repository. That is the price of plain files, and `livedoc wiki check` names such links as
  `across`, never as broken.
- Renaming or moving the target, renaming its repository, or changing a wiki's sync target rewrites these links like
  any rename ([Renames](#renames)).
- **A document in no wiki has no file path**, so no relative link can name it. The link picker offers documents in
  wikis only; a pasted document address stays an ordinary web link.

## Renames

When a document or section is renamed or moved, every link that resolved to it before resolves to it after:

- **In LiveDoc**, the rename rewrites, in every page that holds one, each relative link that resolved to the old path,
  and in a moved page each of its own relative links whose target did not move with it.
- **In the repository**, a move the sync detects ([Native files](../027-repositories/native-files.md#renames-and-moves))
  is a rename like any other, and rewrites the same links. An agent that already fixed them by hand leaves nothing to
  rewrite: only links still pointing at the old path change.
- **On a branch**, a rename or move rewrites links on that branch only: each page holding a link to it changes on
  its own branch of the same name, started for it, so main's links change when the branch merges and a git branch's
  pull request shows the rewrites beside the move.
- **A rewrite changes the path and nothing else**: the link text, the anchor, `./`, angle brackets and percent
  encoding stay as written. Each page's rewrites are one changeset by the person who renamed (or the syncing person,
  for a move found in the repository), with the summary "Links to <new path>", and they sync out with the move.
- **A document moved out of every wiki** loses its file path, so the links to it can no longer be written. The move
  lists the pages that link to it before it lands; after it, those links are broken (`moved-out`), with **Undo the
  move** offered.
- **A renamed heading** is not followed: links to its old anchor become broken, with **Point at <nearest heading>**
  offered. Headings change with every keystroke while someone types one, so following them would rewrite other pages
  mid-word.
- Links in files LiveDoc does not hold (a project's `README.md` linking into its wiki) cannot be rewritten;
  `livedoc wiki check` in the checkout lists those that a move broke ([Links out of the wiki](#links-out-of-the-wiki)).

## Links out of the wiki

A relative link that climbs out of the link's `dir` points at the repository, not at LiveDoc: code, a project's
`README.md`, another documentation tree.

- It is kept as written, and never rewritten by LiveDoc.
- In LiveDoc it opens the file in the repository's web view when the link file names one
  (`[repository] web = "https://github.com/<owner>/<repo>/blob/main"`), and is drawn as its path, not clickable,
  otherwise.
- `livedoc wiki check`, run in a checkout, resolves each one against the work tree, and lists links from the
  repository's other markdown into the wiki whose target is missing.

## Broken links

A link is **broken** when its target does not resolve:

| Finding       | When                                                              | Fix offered                                |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `missing`     | No document, section or file at the path                          | **Fix the link**: the nearest page by name |
| `case`        | Only a case-insensitive match                                     | **Fix the case**                           |
| `anchor`      | The page exists; no heading has the slug                          | **Point at <nearest heading>**             |
| `in-trash`    | The target is in the Trash                                        | **Restore** (for whoever may)              |
| `moved-out`   | The target left every wiki                                        | **Undo the move** (for whoever may)        |
| `out-missing` | A link out of the wiki misses in the checkout (`wiki check` only) | None; named with its line                  |

- A link to a document the checking person cannot open is never reported as broken: it is `unreadable`, counted apart,
  because LiveDoc answers a document someone may not open exactly as an absent one.
- Broken links are drawn struck through, with the finding on hover and focus, and listed in the
  [wiki health](wiki.md#wiki-health). LiveDoc never removes a link on its own.

## Backlinks

Every page lists the pages that link to it, under **Linked from** at its foot: each with its title, its wiki when it is
another, and the line around the link. A page with none, in a wiki, is an [orphan page](wiki.md#wiki-health).

## Limits

| Constant                 | Value | Why                                                                                                                                                  |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAGE_LINKS_MAX`         | 5000  | Over ten times the links of the largest real entry page (a 364-page wiki's index holds 360)                                                          |
| `LINK_REWRITE_PAGES_MAX` | 1000  | One rename rewrites at most this many pages in one go; past it the rename still lands and the rest are listed as broken, never half-written silently |

## Observability and telemetry

- Fingerprints, with document ids and counts, never paths or text: `[links] resolved`, `[links] rewritten`,
  `[links] rewrite-capped`, `[links] broken`.
- Telemetry: `Tab · Linked · PageLink` for a link inserted through the link picker, `PageLinkAcrossWikis` for one
  into another wiki; `UI · Changed · LinkFixed` with the fix as its type.
