# Links

**Status: specified.** Nothing is built.

Pages link to each other with **ordinary markdown links**, so one text works in livedocs, on GitHub and in a
checkout read with `rg`. livedocs resolves a link when it draws the page and when it saves it; it never rewrites a
link's text, except to follow a rename ([Renames](#renames)).

## Domain language

| Term                 | Means                                                                                                    | Never called                |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| **link**             | A markdown link or image in a page's text: `[text](target)`, `![alt](target)`, or a reference definition | reference, wikilink         |
| **target**           | What a link points at: a document, a section, a heading of a page, or an address outside                 | destination, href (in copy) |
| **relative link**    | A link whose target is a path from the page's own folder                                                 | local link                  |
| **document address** | A document's permanent address, `https://<host>/document/<document id>`                                  | permalink, share link       |
| **broken link**      | A link whose target livedocs cannot find                                                                 | dead link, 404              |

## Link forms

| From → to                                      | Written as                                                           | Resolves to                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A page → a page of the same wiki               | `[PM2](../tools/pm2.md)`                                             | The page at that path                                               |
| A page → a heading                             | `[Ports](../tools/pm2.md#ports)`, or `#ports` within the page        | The heading whose slug matches, as GitHub slugs it                  |
| A page → a file document                       | `[script](setup.sh)`, `![Flow](img/flow.png)`                        | The file document; an image is drawn                                |
| A page → a diagram or other document           | `[Architecture](architecture.livedoc.md)`, its outline file          | The document, opened on its first tab; `#<tab name>` opens that tab |
| A page → a diagram, drawn in the page          | `![Architecture](architecture.livedoc.svg)`, its render              | The document's first tab, drawn live                                |
| A page → a section                             | `[Tools](../tools/)`                                                 | The section, opened on its `index` or `README` page when it has one |
| A page → another wiki, or anything outside one | Open (Q8); recommended: `[PM2](https://docs.nu/document/doc_3h9x2a)` | The document, by its id                                             |
| A page → the repository outside the wiki       | `[the parser](../../apps/cli/src/parse.ts)`                          | [Links out of the wiki](#links-out-of-the-wiki)                     |
| A page → the web                               | `[Yjs](https://yjs.dev)`                                             | The address, opened in a new browser tab                            |

- Relative links are written to the **native file** paths a sync writes
  ([Native files](../027-repositories/native-files.md#what-a-link-writes)), so a link that works in livedocs works in
  the repository, and the other way round. A wiki that has never synced uses the same paths.
- **A path starting with `/`** is relative to the repository's root, as GitHub reads it. In livedocs it resolves
  inside the wiki when it lands under the link's `dir`, and as a link out otherwise.
- **Spelling.** `my%20page.md`, `<my page.md>` and `./my page.md` resolve alike. Reference-style links resolve as
  inline ones.
- **Case.** A target matches exactly. One that matches only when compared case-insensitively is a broken link with
  **Fix the case** offered: Linux checkouts and GitHub are case-sensitive, so it is broken there.
- **Wiki-link syntax** (`[[PM2]]`) is text, drawn as text; it is not a link.

## Links across wikis

A global wiki and a project wiki live in different repositories, so no relative path is valid in both. How such a
link is written is open ([Open questions](#open-questions), Q8). Written for the recommended answer, a link that
leaves its wiki for a document in livedocs uses the target's **document address**:

- It never breaks on a rename or a move: the id is the document's for good.
- It is clickable everywhere a link is: in livedocs, on GitHub, in a terminal.
- An agent with the target's wiki checked out finds the file by its id in that wiki's
  [sync record](../027-repositories/native-files.md#the-sync-record) (`rg doc_3h9x2a`), or asks
  `livedocs resolve <address>` for the local path, or `livedocs read <address>` for the text.
- The host is the wiki's own: a self-hosted wiki's links name its host, never docs.nu.
- An address grants nothing: a reader who may not open the document sees **Can’t open this page**, exactly as for one
  that does not exist.
- Inserting a link to a page of another wiki (the link picker, a paste of its address) writes this form.

## Renames

When a document or section is renamed or moved, every link that resolved to it before resolves to it after:

- **In livedocs**, the rename rewrites, in every page that holds one, each relative link that resolved to the old path,
  and in a moved page each of its own relative links whose target did not move with it.
- **In the repository**, a move the sync detects ([Native files](../027-repositories/native-files.md#renames-and-moves))
  is a rename like any other, and rewrites the same links. An agent that already fixed them by hand leaves nothing to
  rewrite: only links still pointing at the old path change.
- **A rewrite changes the path and nothing else**: the link text, the anchor, `./`, angle brackets and percent
  encoding stay as written. Each page's rewrites are one changeset by the person who renamed (or the syncing person,
  for a move found in the repository), with the summary "Links to <new path>", and they sync out with the move.
- **A document moved out of its wiki** has its links from the wiki rewritten into the cross-wiki form, since no
  relative path from the wiki reaches it in the repository.
- **A renamed heading** is not followed: links to its old anchor become broken, with **Point at <nearest heading>**
  offered. Headings change with every keystroke while someone types one, so following them would rewrite other pages
  mid-word.
- Links in files livedocs does not hold (a project's `README.md` linking into its wiki) cannot be rewritten;
  `livedocs wiki check` in the checkout lists those that a move broke ([Links out of the wiki](#links-out-of-the-wiki)).

## Links out of the wiki

A relative link that climbs out of the link's `dir` points at the repository, not at livedocs: code, a project's
`README.md`, another documentation tree.

- It is kept as written, and never rewritten by livedocs.
- In livedocs it opens the file in the repository's web view when the link file names one
  (`[repository] web = "https://github.com/<owner>/<repo>/blob/main"`), and is drawn as its path, not clickable,
  otherwise.
- `livedocs wiki check`, run in a checkout, resolves each one against the work tree, and lists links from the
  repository's other markdown into the wiki whose target is missing.

## Broken links

A link is **broken** when its target does not resolve:

| Finding       | When                                                              | Fix offered                                |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `missing`     | No document, section or file at the path                          | **Fix the link**: the nearest page by name |
| `case`        | Only a case-insensitive match                                     | **Fix the case**                           |
| `anchor`      | The page exists; no heading has the slug                          | **Point at <nearest heading>**             |
| `in-trash`    | The target is in the Trash                                        | **Restore** (for whoever may)              |
| `out-missing` | A link out of the wiki misses in the checkout (`wiki check` only) | None; named with its line                  |

- A link to a document the checking person cannot open is never reported as broken: it is `unreadable`, counted apart,
  because livedocs answers a document someone may not open exactly as an absent one.
- Broken links are drawn struck through, with the finding on hover and focus, and listed in the
  [wiki health](wiki.md#wiki-health). livedocs never removes a link on its own.

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

## Open questions

- **Q8. Links across wikis.** The target's **document address** (`https://docs.nu/document/<id>`): stable and
  clickable everywhere, opaque to a reader of the text; a **wiki-qualified path** (`livedocs:<wiki>/<path>`):
  readable, rewritten on renames, not clickable on GitHub; the target's **repository web address** (a GitHub `blob`
  URL): clickable and readable, rewritten while livedocs knows of it, broken by renames in repositories it does not
  sync; or a **relative path between checkouts** (`../../wiki/docs/tools/pm2.md`): readable, but true only on
  machines laid out alike. Recommended: the document address. Tracked in `AMBIGUITIES.md`.
