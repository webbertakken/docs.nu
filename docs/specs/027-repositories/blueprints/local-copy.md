# Local copy: blueprint

Derived from [Local copy](../local-copy.md), with what it takes from [Native files](../native-files.md) and
[Repository link](../repository-link.md), the text of [Markdown tab](../../031-markdown/markdown-tab.md), the bytes of
[File tab](../../006-document/file-tab.md), the names of [Wiki](../../032-wikis/wiki.md) and the commands, exit codes and
read copies of [CLI](../../015-api/cli.md). It extends the [Repository link blueprint](repository-link.md), whose
modules, defaults (`RLn`) and rules hold unless this file says otherwise. The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) as `LCn`.

**This file covers the local copy whole**: a link that git takes no part in, its pages and file documents as native
files, both directions, live and offline, renames, deletes, adoption, a second machine, `sync --take`. It builds on two
tab kinds that have specs and no code; what it needs of them is stated once, as
[Contracts this blueprint consumes](#contracts-this-blueprint-consumes), and is theirs to blueprint and build. What it
leaves to later outcomes is under [Not in this slice](#not-in-this-slice).

Scope, by file. "(planned)" marks a file that does not exist yet; "new" a symbol added to an existing file.

| File                                                                               | Role                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/text-merge/` (planned, `@livedoc/text-merge`)                            | Pure: `mergeText`, `editsBetween`, `editDistance`, `nearestBase`, `similarity`. Shared by the CLI now and `sync --resolve` and the branch merge later |
| `apps/cli/src/link/link-file.ts`                                                   | `LinkFile.git` (new: `binding`, `branch`, `commit`), `LinkFile.mirror.ignore` (new); `[git]` and `ignore` parsed and validated                        |
| `apps/cli/src/link/binding.ts` (planned)                                           | `LinkBinding`, `bindingOf(io, link)`: `local-copy` (with why) or `branches`                                                                           |
| `apps/cli/src/link/native/records.ts` (planned)                                    | `RECORDS_DIR`, `SyncRecord`, `recordPathOf`, `recordText`, `readRecords`, `writeRecord`, `removeRecord`                                               |
| `apps/cli/src/link/native/native-paths.ts` (planned)                               | `nativePathOf`, `splitFileName`, `nameProblem`, `foldKey`, `siblingCollisions`                                                                        |
| `apps/cli/src/link/native/ignore-rules.ts` (planned)                               | `IgnoreRules`, `ignoreRulesOf(io, link, binding)`, `ignoredBecause(rules, entry)`                                                                     |
| `apps/cli/src/link/native/native-scan.ts` (planned)                                | `NativeEntry`, `scanNativeTree(io, link, rules)`: every file under `dir`, hashed, classified                                                          |
| `apps/cli/src/link/native/native-state.ts` (planned)                               | `NativeFacts`, `nativeStateOf` (pure)                                                                                                                 |
| `apps/cli/src/link/native/moves.ts` (planned)                                      | `findMoves` (pure): missing recorded files paired with unrecorded ones                                                                                |
| `apps/cli/src/link/native/native-plan.ts` (planned)                                | `planNative` (pure): records, scan, coverage and remote facts to `NativeAction[]`, the folder-missing guard                                           |
| `apps/cli/src/link/native/bases.ts` (planned)                                      | `keepBase`, `baseCandidates`, `pruneBases`: the kept bases in the local sync state                                                                    |
| `apps/cli/src/link/native/fold-page.ts` (planned)                                  | `foldPage`: nearest base, merge, `patch`, the `stale_tab` loop, lost local values, the write back                                                     |
| `apps/cli/src/link/native/file-document.ts` (planned)                              | `foldFileDocument`, `takeSide`: replace, write, conflict, `--take`, set-aside                                                                         |
| `apps/cli/src/link/native/adopt.ts` (planned)                                      | `adoptFile`, the adoption journal, folder creation, pacing                                                                                            |
| `apps/cli/src/link/native/native-acts.ts` (planned)                                | `actNative`: each `NativeAction` against the tree, the api, the records and the local sync state                                                      |
| `apps/cli/src/link/native/pacer.ts` (planned)                                      | `Pacer`: the token-read and write budgets per minute                                                                                                  |
| `apps/cli/src/link/watch-claim.ts` (planned)                                       | `claimWatch`: one `sync --watch` per link per machine                                                                                                 |
| `apps/cli/src/link/sync-run.ts`                                                    | `runSyncPass` calls `planNative` and `actNative` at `files` for pages and file documents; mirror files as before                                      |
| `apps/cli/src/link/sync-watch.ts`                                                  | `onLocal` takes every non-ignored path under `dir`; transient documents due again; the watch claim                                                    |
| `apps/cli/src/link/remote.ts`                                                      | `RemoteFact` carries each tab's `kind`, `hash` and, for a file tab, `extension` and `executable`                                                      |
| `apps/cli/src/link/recorded-state.ts`                                              | `RecordedDocument` gains `savedAt`, `folderId` (LC9)                                                                                                  |
| `apps/cli/src/link/local-state.ts`                                                 | `bases/`, `set-aside/`, `adoptions.json`, `watch` in the state directory                                                                              |
| `apps/cli/src/link/sync-lines.ts`                                                  | The native action lines, final copy ([Output lines](#output-lines-stdout))                                                                            |
| `apps/cli/src/link/constants.ts`                                                   | The constants under [Constants and configuration](#constants-and-configuration)                                                                       |
| `apps/cli/src/commands/sync.ts`, `packages/agent-verbs/src/verbs/link.ts`          | `sync --take file\|livedoc <path>`                                                                                                                    |
| `apps/cli/src/io.ts`, `apps/cli/src/node-io.ts`, `apps/cli/src/testing/fake-io.ts` | `CliFiles.readBytes`, `stat`; `CliFiles.write` and `writeBytes` take a `mode` and write their temporary as a dotfile (LC14)                           |
| `apps/cli/src/testing/link-host.ts`                                                | The fake host gains markdown and file tabs, `patch`, margin notes, blob replace and create-with-id                                                    |
| `apps/telemetry/app/cli-commands.ts`                                               | `CLI_COMMANDS` row `SyncTake`                                                                                                                         |
| `apps/help/app/developers/repositories/page.mdx`                                   | A "Local copy" section: the global wiki example, `[git] binding`, `sync --watch` under a process manager                                              |

## Domain and naming

| Term                 | Identifier                                     | Meaning                                                                            |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Local copy           | `LinkBinding` `{ kind: 'local-copy', why }`    | A link git takes no part in; `why` is `no-git` or `binding-none`                   |
| Binding              | `LinkFile.git.binding`: `branches` \| `none`   | The link file's `[git] binding`                                                    |
| Copy folder          | `LinkFile.root`                                | The folder holding the link file                                                   |
| Native file          | `NativeEntry` with `role: 'native'`            | A page's or file document's own file                                               |
| Native tab           | `SyncRecord.tab`                               | The tab a native file holds                                                        |
| Sync record          | `SyncRecord`, `.livedoc/main/<id>.json`        | Which document, tab and revision a native file holds, and its hash                 |
| Base                 | `KeptBase`                                     | A page's text at a revision, kept to merge a later edit from                       |
| Nearest base         | `nearestBase`                                  | The candidate fewest characters from the file; a tie takes the newer revision      |
| Lost local value     | `LostStretch`                                  | A stretch both sides changed differently: LiveDoc's text kept, the file's reported |
| Adoption             | `NativeAction` kind `adopt`                    | A `local-new` file becoming a document                                             |
| Adoption journal     | `adoptions.json`                               | Each adoption's chosen id and path, written before its create                      |
| Move                 | `NativeAction` kind `move-here` / `move-there` | A rename or move found in the folder / made in LiveDoc                             |
| Folder-missing guard | `NativeAction` kind `folder-missing`           | The pass that deletes and writes nothing because the folder's files are gone whole |
| Held file            | `NativeAction` kind `held`                     | A file the sync cannot take, with its reason                                       |
| File conflict        | `NativeAction` kind `file-conflict`            | A file document changed on both sides                                              |
| Set-aside            | `<state dir>/set-aside/`                       | Where `--take livedoc` keeps the file's losing bytes                               |
| Watch claim          | `claimWatch`, file `watch`                     | The marker making one watch per link per machine                                   |

Banned: "vault", "workspace", "checkout" or "clone" for a copy folder; "mirror" for a native file (a native file is the
document, not its mirror); "conflict" for a page edited on both sides (it merges; only a file document conflicts);
"sync" for a single act (a sync is a pass); "base" for a record (a record names a revision; a base holds text);
"backup" for set-aside.

## Contracts this blueprint consumes

Each is the [Markdown tab](../../031-markdown/markdown-tab.md)'s or the [File tab](../../006-document/file-tab.md)'s to
blueprint and build; this table is what the local copy needs of them, exactly. Paths are under the api base.

| #   | Contract                                                                                                                                                                                                                                                    | Owner          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| C1  | `GET /documents/:id?view=overview&json=1` gives each tab's `kind`; a markdown or file tab's header also gives `hash` (`sha256:<hex>` of the bytes it writes) and `bytes`                                                                                    | Markdown, File |
| C2  | `GET /documents/:id/tabs/:tab/text` → `{ rev, hash, text, bom, extension }` for a markdown tab; `not_a_markdown_tab` otherwise                                                                                                                              | Markdown       |
| C3  | `GET /documents/:id/tabs/:tab/blob` → the bytes, with `X-Livedoc-Rev`, `X-Livedoc-Hash`, `X-Livedoc-Executable` and `X-Livedoc-Extension` headers                                                                                                           | File           |
| C4  | A markdown changeset `{ base, summary, ops: [{ op: 'patch', edits: [{ from, to, text }] }] }` → `{ rev, hash }`; edits in UTF-16 code units of the `base` revision's text (LC4); rejections `stale_tab` (412), `text_too_large` (413), `not_a_markdown_tab` | Markdown       |
| C5  | A margin note written with a changeset: `notes: [{ from, to, body }]` beside `ops`, anchored in the result text, authored by the caller                                                                                                                     | Markdown       |
| C6  | `PUT /documents/:id/tabs/:tab/blob` with `If-Match: <rev>` (absent with `--take file`) and `X-Livedoc-Executable` → `{ rev, hash }`; `412 stale_tab`; `413` past `FILE_TAB_MAX_BYTES`; the replaced bytes become a previous version                         | File           |
| C7  | `POST /documents` with a client-chosen `id` and one seeded tab `{ kind: 'markdown', text, bom, extension }` or `{ kind: 'file', blob, extension, executable }`; a repeated id answers `409 document_exists`                                                 | Markdown, File |
| C8  | `POST /blobs` (the bytes; answers `{ blob }`, the SHA-256, stored once per owner)                                                                                                                                                                           | File           |
| C9  | Every markdown persist and every blob replace sets the document's `savedAt`, as every tab write does today (`apps/api/src/db/tabs.ts`)                                                                                                                      | Markdown, File |

The rest is the api as it is: `GET /documents`, `GET /folders`, team libraries (`readLibraries`), `PUT /documents/:id`
`{ name }` (`document.rename`), `PUT /documents/:id/folder` (placement), `DELETE /documents/:id` (`document.rm`, to the
Trash), `POST /folders` (`folder.create`), `PUT /folders/:id` `{ name, parentId }`, `DELETE /folders/:id`, the room
ticket and socket (`openRoomStream`).

## Behaviour and state

### The binding (`bindingOf`)

1. `gitDirOf(io, link.root)` (exists). `null`: `{ kind: 'local-copy', why: 'no-git' }`.
2. Inside a work tree, `link.git.binding === 'none'`: `{ kind: 'local-copy', why: 'binding-none' }`.
3. Otherwise `{ kind: 'branches' }`: this slice keeps the repository link's first slice for mirror files and holds
   every page and file document back, reason `binding-unbuilt` (LC1).

Debug `[sync] local-copy <link id> <why>` once per pass. A local copy never runs `git` beyond `rev-parse` (the state
directory, RL8) and `check-ignore` (LC6).

### One pass at `files` (extends `runSyncPass`)

The repository link's steps 1 to 9 hold. Between its step 4 (scan) and step 6 (plan), a local copy adds:

1. **Records.** `readRecords(io, link)`: every `.livedoc/main/*.json`; one that does not parse, names another
   document than its file name, or a path outside `dir` is dropped and logged `[sync] record-invalid` (spec: rebuilt,
   never trusted).
2. **Native scan.** `scanNativeTree` (below): every file under `dir`, each with its SHA-256 and size.
3. **Remote facts, narrowed** (LC9). A native document (one tab, markdown or file) whose list entry from coverage
   (`savedAt`, `name`, `folderId`) equals what `state.json` recorded, and whose file's hash equals its record, is
   `in-step` with no overview read. Every other covered or recorded document is read (`readRemoteFacts`, C1).
4. **Plan.** `planNative` (below), beside `planSync` for mirror files; the two share the coverage and the totals.
5. **Act.** `actNative` in this order: guard, moves (there, then here), folds and writes, adoptions, deletes, removals,
   empty-folder cleanup, records. Each act re-reads its file and compares it with the scan before it writes or removes
   (the repository link's rule): changed meanwhile, the act becomes the next pass's, debug
   `[sync] changed-during-pass`.
6. **Records and state.** Each act that settles a document writes its record (`writeRecord`) and its
   `RecordedDocument` (`{ name, savedAt, folderId, tabs: { <tab>: { rev, syncedAt } } }`) at once, not at the pass's
   end, so an interrupted pass resumes (spec: interrupted adoption).

### The native scan (`scanNativeTree`)

Walks `<root>/<dir>` depth first in byte order of names (RL4), never following a symbolic link. Each entry:

| `role`      | When                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `generated` | `INDEX.md` with the generated first line, `*.livedoc.json`, `*.livedoc.md`, `*.livedoc.svg`, the link file, anything under `.livedoc/` |
| `ignored`   | `ignoredBecause` answers a reason (below)                                                                                              |
| `native`    | Every other file                                                                                                                       |

`NativeEntry = { path, role, size, hash, executable, reason? }`; `path` relative to `dir`, POSIX separators; `hash`
`sha256:<hex>` of the bytes; files over `FILE_TAB_MAX_BYTES` are not read (`hash: null`, reason `too-large`).

Ignore reasons, in this order (`ignoredBecause`): `dotfile` (any segment starting with `.`), `link` (a symbolic
link), `editor-leftover` (`*~`, `#*#`, `.#*`, LC5), `ignore-glob` (a `[mirror] ignore` glob, matched with `picomatch`,
LC7), `gitignored` (`git check-ignore --stdin` inside a work tree, one call per pass, LC6), `too-large`,
`lfs-pointer` (a file under 1024 bytes opening `version https://git-lfs.github.com/spec/v1`).

### Records (`records.ts`)

```json
{
  "path": "tools/pm2.md",
  "document": "doc_3h9x2a",
  "tab": "0b34",
  "rev": 41,
  "hash": "sha256:9f2c…"
}
```

- One line, keys in that order, then `\n` (`recordText`); no `branch` (main), no time. A file kept out of git is a
  committed-files concern and never written by a local copy.
- `recordPathOf(id)` is `<root>/.livedoc/main/<id>.json`; ids are the api's (RL3), so a file name never needs escaping.
- Written as every file is (temporary dotfile, rename), mode 0644: records are as readable as the files they describe.

### States (`nativeStateOf`)

Input per document: its record `r` (or none), the entry at `r.path` (or none), the entry at the document's native
path now, and the remote fact `d`. Output, first match wins:

| #   | Condition                                                                               | State                                             |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| S1  | `d` transient                                                                           | `transient`                                       |
| S2  | `d` is `410 document_trashed`, or readable and outside coverage                         | `gone`                                            |
| S3  | `d` is `404`                                                                            | `unreadable`                                      |
| S4  | No record, no entry at its path                                                         | `new`                                             |
| S5  | No record, an entry at its path: hash equals `d.hash`                                   | `in-step` (record rebuilt)                        |
| S6  | No record, an entry at its path that differs                                            | `diverged`, base search without a record revision |
| S7  | A record, no entry at `r.path`                                                          | `deleted` or `moved` ([Moves](#moves-findmoves))  |
| S8  | Entry hash = `r.hash`, `d.rev = r.rev`, path unchanged                                  | `in-step`                                         |
| S9  | Entry hash = `r.hash`, `d.rev ≠ r.rev` or `d.hash ≠ r.hash`, or the native path differs | `behind`                                          |
| S10 | Entry hash ≠ `r.hash`, `d.rev = r.rev`                                                  | `ahead`                                           |
| S11 | Entry hash ≠ `r.hash`, `d.rev ≠ r.rev`                                                  | `diverged`                                        |

A document of more than one tab keeps its native file for its native tab (`r.tab`, else the first) and its other tabs
in a mirror file, which `planSync` handles as before.

### Moves (`findMoves`)

Over the whole scan, whatever the pass's scope (LC10): `missing` = recorded files absent, `unrecorded` = native
entries with no record and at no covered document's native path.

1. **Equal bytes first.** Each missing file, in path order, takes the first unrecorded entry whose hash equals its
   record's hash.
2. **Then alike pages.** For the missing pages left and the unrecorded `.md`/`.markdown` entries left, every pair
   scores `similarity(baseText, entryText)` (LC11); pairs at or above `SYNC_RENAME_SIMILARITY` are taken from the
   highest score down, each entry and each missing file once. Equal top scores for one missing file are no move.
3. A pair is `move-here`: the document is renamed to the entry's name (`document.rename`) and moved to the folder its
   directory names (created as adoption creates them), then its content folds back as `ahead` or `diverged`.
4. **A whole directory renamed** (every document recorded under one directory moved to one new directory, and no
   folder of that name exists): the folder is renamed (`PUT /folders/:id`) instead, keeping its id (LC12).
5. **Both sides renamed** (`d.name` and the entry's name differ from the record's): LiveDoc's name stands; the file is
   moved back to LiveDoc's path, and the line says the folder's name was not applied.
6. **Case only** (old and new paths fold to one `foldKey`): moved through `<path>.livedoc-case-<pid>` (a temporary
   rename), so a case-insensitive file system sees it.

A missing file with no pair is `deleted`. An unrecorded entry with no pair is `local-new`.

### Deletes, and the folder-missing guard

- **Guard** (before anything acts): `dir` missing, or records exist and none of their paths is present. The pass
  plans one `folder-missing` action and nothing else for native files: no write, no delete, no adoption, records kept.
  Exit 1; `[sync] folder-missing <count>`. Mirror files are untouched by the guard.
- **`deleted`**, the remote unchanged since the record (`d.rev = r.rev`): `document.rm` (to the Trash), record and
  `RecordedDocument` removed. Changed since: the file is written again (`edit outranks delete`).
- **`gone`**, the file unchanged since its record: removed, record removed. Changed: kept and refused
  (`gone-changed`), as the repository link does.
- **Empty folders.** After the acts, a directory the pass emptied is removed (RL9's rule), and a LiveDoc folder whose
  documents all left by deletes or moves of this pass, holding no subfolder and no document, is deleted
  (`DELETE /folders/:id`, LC13). The covered folder itself never is.

### Folding a page back (`foldPage`)

1. **Read.** The remote text at `d.rev` (C2). Not UTF-8 on disk (`TextDecoder('utf-8', { fatal: true })` throws):
   held, reason `not-utf8`, nothing sent.
2. **Candidates** (`baseCandidates`): the kept bases of the tab, the CLI's read copies of the tab
   (`READ_COPY_REVS_PER_TAB`, `apps/cli/src/sync/read-copies.ts`), and the remote text when `d.rev = r.rev`. Never the remote
   text at a newer revision (spec).
3. **Nearest.** `nearestBase(fileText, candidates)`: least `editDistance`, a tie to the higher revision;
   `[sync] nearest-base <doc> <rev>`. No candidate: baseless (below).
4. **Merge.** `mergeText({ base, local: fileText, remote })` → `{ text, lost }`.
5. **Send.** `editsBetween(remote, text)` as one `patch` (C4) based on `d.rev`, summary `From <path>`, with each lost
   stretch as a margin note (C5) `Not applied from <path>: <localText>`. No edits and no lost stretch: nothing sent.
   `stale_tab`: re-read and repeat from step 1, up to `SYNC_MERGE_ATTEMPTS`; then held, reason `busy`.
6. **Write back.** The answer's revision's bytes are written when the file still holds what the scan read; the record
   takes the answer's `rev` and `hash`, and the written text is kept as a base.

**Baseless.** No candidate: LiveDoc's text stands; `mergeText` runs with `base = remote`, so every stretch where the
file differs is a lost stretch (the spec's baseless merge), each a margin note; the file is then written with
LiveDoc's text.

### The text merge (`@livedoc/text-merge`)

- **Tokens.** Lines keep their own ending (`\n`, `\r\n` or a lone `\r`); words are runs of non-space and runs of space,
  so whitespace merges as it was typed.
- **`mergeText`.** `diff3Merge` (`node-diff3`, `excludeFalseConflicts: true`) over lines; each conflicting hunk again
  over the words of its three sides; a word-level conflict keeps the remote's tokens and yields a `LostStretch
{ from, to, localText }`, offsets in the merged text. A change made on both sides alike is taken once.
- **`editsBetween(a, b)`.** Lines first (`diffPatch` over line tokens), then characters inside each changed hunk,
  as `{ from, to, text }` in UTF-16 code units of `a`, ascending, non-overlapping.
- **`editDistance(a, b)`.** The sum of removed and inserted lengths of `editsBetween(a, b)`.
- **`similarity(a, b)`.** Bytes of lines common to both (as a multiset) over the larger size (LC11).

### A file document (`foldFileDocument`)

| File since its record | LiveDoc since the record | Act                                                           |
| --------------------- | ------------------------ | ------------------------------------------------------------- |
| Changed               | Unchanged                | `POST /blobs`, then C6 with `If-Match: r.rev`; record updated |
| Unchanged             | Changed                  | C3, write the bytes and the executable bit; record updated    |
| Changed               | Changed                  | `file-conflict`: nothing written or sent; both ways out named |
| Executable bit only   | either                   | As changed bytes: the bit travels as the bytes do             |

`412` on the replace is `file-conflict` too. **`sync --take file <path>`**: C6 without `If-Match`. **`--take
livedoc <path>`**: the file's bytes are first written to `<state dir>/set-aside/<startedAt>-<basename>` (LC19), then
C3's bytes over the file. Either way the record follows, and `[sync] taken <doc> <side>`.

### Adoption (`adoptFile`)

1. **Kind.** `.md`/`.markdown` decoding as UTF-8 and at most `MARKDOWN_TEXT_MAX_BYTES`: a page (`bom` from a leading
   `EF BB BF`, `extension` from the name). Otherwise a file document, `mediaType` left to the api; a `.md` file that is
   not UTF-8 or too large is a file document marked by the api (Markdown tab "Reading a file").
2. **Name.** `splitFileName`: the name before the last dot, the extension after it; a name with no dot (or only a
   leading one, never adopted) has extension `''` (LC16).
3. **Checks.** `nameProblem(name)` (the native-files characters, endings and reserved names) and `siblingCollisions`
   (`foldKey`: NFC, then lower case, with the extension) against LiveDoc's siblings and the scan's: held, reason
   `name` or `collides`, naming the other.
4. **Folder.** The directory's segments, found under the covered folder by exact name, created where missing
   (`folder.create`), in order.
5. **Journal, then create.** `adoptions.json` gains `{ path, id, hash }` (the id `crypto.randomUUID()` in the api's id
   form, LC17) before C8/C7 run. At the next pass, a journal entry whose id answers `200` is the document: its record is
   written and the entry dropped; one answering `404` is created again with the same id; one answering `409
document_exists` for another owner never happens (ids are random) and is held, reason `id-taken`.
6. **Record** and `RecordedDocument` written at once; `[sync] adopted <doc>`.

Adoptions and every other write go through the `Pacer` (`SYNC_WRITES_PER_MINUTE`), reads with a token through its read
budget (`SYNC_READS_PER_MINUTE`), so the first sync of a 375-page wiki stays under the api's limits (LC8).

### Bases (`bases.ts`)

- `bases/<document id>/<tab id>/<rev>.md`: the text's UTF-8 bytes (the BOM is not text).
- Kept at every write of a page's file, every send, and every scan that finds a file equal to its record and no base
  at that revision (spec: a file that matches its record is a base). The newest `SYNC_BASES_KEPT` revisions per tab
  are kept; a document's directory goes with its record.

### `sync --watch` on a local copy

The repository link's watch holds (RL19 to RL25), with:

- **The claim.** Before its first pass, `claimWatch` creates `<state dir>/watch` exclusively (`{ pid, hostname,
startedAt }`). Present and alive (RL34's test): exit 5, `watch_running`, naming the pid (LC18). A dead holder on this
  hostname is taken over and logged. Removed on stop.
- **Local events.** `onLocal` takes every path under `dir` whose `ignoredBecause` is none (not only
  `*.livedoc.json`), settles it for `SYNC_LOCAL_SETTLE_MS`, and adds it to the pending scope with the document its
  record names. A path that is gone when it settles is in scope as a delete; the pass judges it against the whole
  scan (Moves).
- **Own writes.** Every path the pass wrote or removed is kept with its hash (RL23), the records included.
- **Retrying.** Each document a pass left `transient` is due again at the next coverage read
  (`SYNC_WATCH_COVERAGE_MS`), as well as at its room stream's reconnect (RL22); nothing waits for a restart.
- **Streams.** Opened in index order, at most `SYNC_STREAM_OPENS` at a time, so a 375-page wiki's watch starts without
  a burst of tickets (LC15).

## Interfaces and contracts

### The link file

| Key               | Type                               | Default      | Rejection                                                              |
| ----------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `[mirror] ignore` | array of strings, each a glob      | `[]`         | `invalid_value`: "mirror.ignore must be an array of globs"             |
| `[git] binding`   | `"branches"` \| `"none"`           | `"branches"` | `invalid_value`: "git.binding must be branches or none, not "<value>"" |
| `[git] branch`    | string                             | none         | `invalid_value`; parsed for Branch binding, unread by a local copy     |
| `[git] commit`    | `"none"` \| `"commit"` \| `"push"` | `"none"`     | `invalid_value`; parsed for Native files' git, unread by a local copy  |

`link init --dir <d>` (new flag, from [Wiki](../../032-wikis/wiki.md#bringing-an-existing-wiki-in)) writes `[mirror]
dir`, validated as RL3's `dir`. `link init --binding none|branches` (new flag) writes `[git] binding`. Without the flag, inside a work tree, it
writes no `[git]` table and prints one stderr line: `This folder is a git work tree: run link init --binding none to
keep it a local copy.` (LC2). Outside any work tree it writes no `[git]` table and prints nothing.

### `sync --take`

`livedoc sync --take file|livedoc <path>`: one file document, by its path. A path that is no file document in
`file-conflict` exits 1 (`not_in_conflict`), naming its state; an unknown side exits 2. Telemetry type `SyncTake`.

### Output lines (stdout)

Prefixes as the repository link: `+` created or written new, `~` changed, `>` moved, `-` removed or deleted, `!`
refused or held, `?` reported. `<p>` is the path as the working directory reaches it.

| Action               | Line                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| write (`new`)        | `+ <p>  "<name>" · rev <n>`                                                                              |
| write (`behind`)     | `~ <p>  "<name>" · rev <a>→<b>`                                                                          |
| send (`ahead`)       | `~ <p>  sent · rev <a>→<b>`                                                                              |
| merge (`diverged`)   | `~ <p>  merged · rev <a>→<b>` and, when lost stretches exist, ` · <n> not applied: see the margin notes` |
| adopt                | `+ <p>  adopted as "<name>"`                                                                             |
| move-here            | `> <old p> → <new p>  renamed in LiveDoc`                                                                |
| move-there           | `> <old p> → <new p>`                                                                                    |
| deleted              | `- <p>  deleted: "<name>" is in the Trash`                                                               |
| gone                 | `- <p>  removed: "<name>" was deleted in LiveDoc`                                                        |
| edit outranks delete | `+ <p>  written again: "<name>" changed in LiveDoc since it was deleted here`                            |
| file-conflict        | `! <p>: changed here and in LiveDoc. Keep one: livedoc sync --take file <p>, or --take livedoc <p>`      |
| taken (livedoc)      | `~ <p>  took LiveDoc's; yours is at <set-aside path>`                                                    |
| held                 | `! <p>: <reason text>`                                                                                   |
| folder-missing       | `! <dir> is missing its files: nothing was deleted. Put them back, or delete the documents in LiveDoc.`  |
| unreadable           | `? <p>: not found in LiveDoc, or not yours to open; left as it is`                                       |

Held reasons, final copy: `name`: `“<name>” can’t be a file name: remove <character>`; `collides`: `has the same name
as <other p> on a case-insensitive disk`; `too-large`: `larger than 25 MB, the most LiveDoc holds for one file`;
`not-utf8`: `is no longer UTF-8 text; save it as UTF-8 to send it`; `text-too-large`: `is larger than 1 MB, the most a
page holds`; `busy`: `still changing in LiveDoc; it is merged at the next sync`; `binding-unbuilt`: `this link syncs
with git branches; set [git] binding = "none" to sync it as a local copy`; `id-taken`: `could not be created; run
livedoc sync again`; `host-too-old`: `this host does not hold pages and files; update it to sync them`. Ignored files print nothing at a sync and one line each at `--dry-run`: `· <p>: ignored
(<reason>)`.

## Data and persistence

No D1 table or migration of this blueprint's own (the tab kinds bring theirs). Files:

| File                                       | Class   | Notes                                                                                                          |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `<root>/livedoc.toml`                      | config  | Written by `link init`; travels with the folder                                                                |
| `<root>/.livedoc/main/<id>.json`           | state   | The sync record; travels with the folder                                                                       |
| `<root>/<dir>/…`                           | content | The pages and file documents, byte for byte                                                                    |
| `<state dir>/state.json`                   | state   | `RecordedDocument` gains `savedAt`, `folderId`; `version` stays 1, absent fields read as unknown (always read) |
| `<state dir>/bases/<doc>/<tab>/<rev>.md`   | content | Kept bases, 0600                                                                                               |
| `<state dir>/adoptions.json`               | state   | `{ version: 1, entries: [{ path, id, hash }] }`, 0600                                                          |
| `<state dir>/set-aside/<startedAt>-<name>` | content | `--take livedoc`'s losing bytes, 0600, never pruned (the person's bytes)                                       |
| `<state dir>/watch`                        | state   | `{ pid, hostname, startedAt }` while a watch runs                                                              |

- **State dir**: RL8's rule: `<git dir>/livedoc/<link id>/` inside a work tree (a `binding = "none"` wiki included),
  else `${XDG_CACHE_HOME:-~/.cache}/livedoc/links/<link id>/`.
- **Snapshot and restore.** The folder alone (files, link file, records) restores the copy on any machine; the state
  directory adds only bases, reports and the journal.
- **Migration.** A first-slice `state.json` without `savedAt` reads every native document's overview once.
- **Writes.** Temporary dotfile beside the target (`.<name>.<pid>.tmp`), then `rename(2)`; the target's existing mode
  is kept on a rewrite, a new file is 0644 (0755 when executable), each narrowed by the umask (LC14).

## Errors and edge cases

| #   | Case                                                          | Handling                                                                                                        |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| E1  | `dir` missing, unmounted, emptied                             | Folder-missing guard; nothing deleted or written; exit 1                                                        |
| E2  | `.livedoc/` deleted                                           | Every file rebuilt by path (S5/S6); nothing is created twice                                                    |
| E3  | A record edited into nonsense                                 | Dropped, logged, rebuilt                                                                                        |
| E4  | State dir deleted (bases lost)                                | Edits fold back from read copies, else baseless                                                                 |
| E5  | Copy folder moved to another path                             | New link id, new state dir; records still match: snapshots, no edits                                            |
| E6  | Pass interrupted mid-adoption                                 | The journal resumes it with the same id                                                                         |
| E7  | Offline or 5xx mid-pass                                       | Those documents transient, files untouched; others proceed; exit 7                                              |
| E8  | 429                                                           | Transient (RL14); the pacer keeps a healthy pass under it                                                       |
| E9  | 401                                                           | The pass ends before any write; exit 4                                                                          |
| E10 | A file edited while the pass writes it                        | Re-read before the rename; changed: not written, next pass merges                                               |
| E11 | An editor's write landing between that re-read and the rename | Residual: the window is one `rename(2)`; logged `[sync] wrote`; the next save of the editor's buffer folds back |
| E12 | A rename seen as two events                                   | Moves judged over the whole scan; a lone half never deletes                                                     |
| E13 | Write then delete instead of a rename (non-atomic tools)      | Adoption plus a delete: content kept, the old document in the Trash                                             |
| E14 | A page saved as Latin-1                                       | Held `not-utf8`; LiveDoc unchanged                                                                              |
| E15 | A page grown past 1 MiB                                       | `text_too_large`: held                                                                                          |
| E16 | `stale_tab` three times                                       | Held `busy`; the next pass merges                                                                               |
| E17 | Two files folding to one name                                 | Both held `collides`, each naming the other                                                                     |
| E18 | Name with a forbidden character, in LiveDoc or the folder     | Held `name`; nothing renamed for it                                                                             |
| E19 | A symbolic link, inside `dir` or as `dir`                     | Never followed; ignored; a `dir` that is a link is refused `invalid_dir` (RL3)                                  |
| E20 | A second watch                                                | Exit 5, naming the pid                                                                                          |
| E21 | Two machines on one shared folder                             | Each reads the other's writes as snapshots (records travel) or edits                                            |
| E22 | A document moved out of coverage                              | `gone`: file removed unless changed (kept, refused)                                                             |
| E23 | View-level token                                              | Writes files; every send held as not sent (the repository link's rule)                                          |
| E24 | A file document over 25 MiB                                   | Ignored `too-large`, left in place                                                                              |
| E25 | The api lacks markdown or file tabs (an older self-host)      | C1 without `kind`: pages and files held, reason `host-too-old` (LC3)                                            |
| E26 | A link at `files` inside a work tree, `binding = "branches"`  | Pages and file documents held `binding-unbuilt`; mirror files as before                                         |
| E27 | Case-only rename                                              | Through a temporary name                                                                                        |
| E28 | `--take` on a path not in conflict                            | Exit 1, `not_in_conflict`                                                                                       |

## Security and trust

- **Paths.** Every path a pass writes is built from validated names (`nameProblem`): no `/`, `\`, `..`, control
  character or reserved name can reach the file system. Before each write or move, every directory from `<root>/<dir>`
  down is checked with `lstat` to be a directory, never a link, so a folder swapped for a link mid-pass cannot steer a
  write outside the copy folder.
- **Records are not trusted**: a record's `path` must equal the document's native path or the file it names, under
  `dir`; otherwise it is dropped.
- **Credentials** never reach the folder, the records, the state directory or a line; the state directory is 0700.
- **Executable bits** travel only for file documents, exactly as LiveDoc holds them; the sync never runs a file.
- **Who may**: each request carries the person's own token; the api's share-role gates decide (Editor sends;
  Participant and Viewer tokens are view-level).
- **Abuse**: the pacer keeps one copy's traffic under the api's per-token limits; the api's own limits stand.

## Performance and limits

| Measure                                       | Budget                                                         | Basis                                             |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Pass with nothing changed (375 pages, 3.1 MB) | ≤ 1 s; 3 to 4 list reads, no overview read                     | LC9; scan hashes 3.1 MB in well under 100 ms      |
| First sync adopting the wiki                  | ≈ 375 creates + 37 folders at `SYNC_WRITES_PER_MINUTE` ≈ 4 min | WRITE_RATE_LIMITER 300/60 s per token             |
| First sync on a second machine                | ≈ 375 text reads at `SYNC_READS_PER_MINUTE` ≈ 4 min            | API_TOKEN_READ_RATE_LIMITER 120/60 s              |
| One settled file edit to LiveDoc              | `SYNC_LOCAL_SETTLE_MS` + 3 requests                            | Overview, text, changeset                         |
| One settled browser edit to the file          | `WAIT_SETTLE_MS` + 2 requests                                  | Overview, text                                    |
| Merge of the largest page (1 MiB)             | ≤ 200 ms                                                       | Line diff first; characters only inside hunks     |
| Bases on disk                                 | ≤ 5 × 3.1 MB for the wiki                                      | `SYNC_BASES_KEPT`                                 |
| Watch sockets                                 | One per covered document, hibernated in their rooms            | Room stream; opened `SYNC_STREAM_OPENS` at a time |

## Presentation and UX

The CLI is the surface: [Output lines](#output-lines-stdout) are final copy, stdout data only, hints on stderr,
one line per pass under `--watch` (RL25). `--dry-run` lists adoptions, holds and ignores before anything is written.
In LiveDoc, a lost local value shows as the markdown tab's margin note; its drawing is the markdown tab's.

## Observability

Under `LIVEDOC_DEBUG=1`, scope `sync`, ids and counts only, never paths or text (a path is logged as the first 8 hex
of its SHA-256): `[sync] local-copy`, `record-invalid`, `adopted`, `ignored` (with the reason), `moved` (here or
there), `deleted`, `gone`, `nearest-base` (with the revision and the distance), `patched` (with the edit count),
`lost-local-value` (with the count), `file-conflict`, `taken`, `folder-missing`, `watch-refused`, `paced` (with the
wait), `changed-during-pass`, `kept-base`. The pass report (`reports/`) keeps every line.

## Testing

Vitest on the fake io and the fake host; each row a spec rule.

| Spec rule (Local copy unless named)                          | Suite                                | Test                                                               |
| ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------ |
| What makes a link a local copy                               | `binding.test.ts`                    | `no-git`, `binding-none`, `branches` inside a work tree            |
| `[git] binding`, `[mirror] ignore` keys                      | `link-file.test.ts`                  | Defaults, each rejection by name                                   |
| Records travel with the folder                               | `records.test.ts`                    | Bytes stable; invalid dropped; path outside `dir` dropped          |
| Never documents                                              | `native-scan.test.ts`                | Link file, `.livedoc/`, generated files, dotfiles, each reason     |
| States S1 to S11                                             | `native-state.test.ts`               | One test per row                                                   |
| Renamed or moved; both sides; case only; directory renamed   | `moves.test.ts`                      | Equal bytes; similarity; tie; whole directory; case-only           |
| A folder gone whole                                          | `native-plan.test.ts`                | `dir` missing; all recorded missing; one left present: deletes     |
| Edit outranks delete                                         | `native-plan.test.ts`                | Deleted here, changed there: written again                         |
| Base: nearest; never LiveDoc's newer text; record match kept | `bases.test.ts`, `fold-page.test.ts` | Candidates; tie to newer; stale file baseless                      |
| Merge by line then word; same change once; lost stretch      | `text-merge` suites                  | Each table row of Repository link "Merging" for text               |
| Round trip byte for byte                                     | `fold-page.test.ts`                  | CRLF, lone CR, BOM, no final newline, NFD                          |
| File document table and `--take`                             | `file-document.test.ts`              | Each row; set-aside written before overwrite                       |
| Interrupted adoption resumes                                 | `adopt.test.ts`                      | Crash after journal, after create, after record                    |
| Adoption changes no file                                     | `adopt.test.ts`                      | Tree bytes and modes identical before and after                    |
| One watch per copy folder                                    | `watch-claim.test.ts`                | Alive holder refused; dead holder taken over                       |
| Watch: both directions, own writes, offline, retry           | `sync-watch.test.ts`                 | Room op → file; file → patch; own write ignored; transient retried |
| Second machine                                               | `second-machine.test.ts`             | Copied folder; empty folder; older files without records           |
| Pacing                                                       | `pacer.test.ts`                      | 375 adoptions never exceed the budget per minute                   |
| Output lines                                                 | `sync-lines.test.ts`                 | Every line's final copy                                            |

**End to end, for real** (the plan's proof): the local stack (api worker, live app, sign-in on), the CLI built
(`apps/cli/dist/livedoc.mjs`), a copy of the global wiki at `/tmp/livedoc-local-copies-wiki`: adopt it, then a
Playwright spec (`apps/live/e2e/local-copy.spec.ts` (planned), dark mode) types in a page and waits for the file, edits the
file and waits for the page, renames and deletes on each side, and stops the watch, edits both sides, restarts and
asserts the merge.

## Constants and configuration

| Constant                  | Value      | Provenance                                                     | Safe range  |
| ------------------------- | ---------- | -------------------------------------------------------------- | ----------- |
| `RECORDS_DIR`             | `.livedoc` | Native files "The sync record"                                 | fixed       |
| `SYNC_BASES_KEPT`         | 5          | Repository link "Limits"                                       | 2 to 20     |
| `SYNC_MERGE_ATTEMPTS`     | 3          | Repository link "Limits"                                       | 1 to 10     |
| `SYNC_RENAME_SIMILARITY`  | 0.5        | Native files "Limits" (git's threshold)                        | 0.3 to 0.9  |
| `SYNC_LOCAL_SETTLE_MS`    | 1500       | Repository link "Limits" (exists)                              | 500 to 5000 |
| `SYNC_WRITES_PER_MINUTE`  | 120        | LC8: under `WRITE_RATE_LIMITER` 300/60 s, leaving room to edit | 30 to 250   |
| `SYNC_READS_PER_MINUTE`   | 100        | LC8: under `API_TOKEN_READ_RATE_LIMITER` 120/60 s              | 30 to 110   |
| `SYNC_STREAM_OPENS`       | 10         | LC15                                                           | 1 to 50     |
| `FILE_TAB_MAX_BYTES`      | 26,214,400 | File tab "Limits"                                              | spec-fixed  |
| `MARKDOWN_TEXT_MAX_BYTES` | 1,048,576  | Markdown tab "Limits"                                          | spec-fixed  |

## Assets and external resources

| Dependency   | Version | Licence | Where                          | Why                                         |
| ------------ | ------- | ------- | ------------------------------ | ------------------------------------------- |
| `node-diff3` | 3.2.1   | MIT     | `@livedoc/text-merge`, bundled | Three-way merge and diffs over token arrays |
| `picomatch`  | 4.0.7   | MIT     | `apps/cli`, bundled            | `[mirror] ignore` globs (LC7)               |

Both are the latest at the time of writing and confirmed again when added. No other asset.

## Not in this slice

- **Branch binding**, hooks, the merge driver, commits and pushes, `sync --resolve`, `link clean`, the managed
  `.gitignore` section: a local copy has none, and a `branches` link holds its pages back (E26).
- **The diagram merge** (`@livedoc/tab-merge`): mirror files of diagrams in a local copy keep the first slice's
  rules (`ahead` and `diverged` refused, naming `push`).
- **Renders** (`.livedoc.svg` for a page that embeds a document).
- **Link rewriting on a move** ([Links](../../032-wikis/links.md#renames)): the api's, when Links is built; a move
  found here renames and moves the document only.
- **`unlink` for a local copy**: removing the link file and `.livedoc/` by hand ends it (spec).
- **The api refusing a non-portable name** in a folder a link covers: the sync holds such names back (E18) until the
  wiki mark gives the api a folder to refuse in.

## Defaults ledger

LC1 to LC19 in [DEFAULTS.md](DEFAULTS.md).
