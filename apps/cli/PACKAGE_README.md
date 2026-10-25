# livedoc

The command line for [LiveDoc](https://docs.nu): read, build, edit and discuss documents from a terminal,
built first for coding agents and second for scripts.

```bash
npx @livedoc/cli --help
```

or install it, which gives you the `livedoc` command:

```bash
npm install -g @livedoc/cli
livedoc --help
```

## Sign in

Create an API token in LiveDoc (Settings › API Tokens), then either set it for a command:

```bash
export LIVEDOC_TOKEN=lvd_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livedoc auth login --with-token
```

The CLI never prompts. A self-hosted LiveDoc is reached with `--host https://…` or `LIVEDOC_HOST`.

## Start

```bash
livedoc document ls auth            # find a document
livedoc tab view "Auth flow"        # its first tab, as an outline
livedoc tab lint "Auth flow"        # what is wrong with how it is drawn
livedoc edit "Auth flow" -f ops.txt # change it with edit operations
livedoc guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livedoc skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `livedoc telemetry off`, `LIVEDOC_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
