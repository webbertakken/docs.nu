#!/usr/bin/env bash
# Creates or updates the one preview comment on a pull request (docs/specs/016-platform/preview-deployments.md).
# The comment is found by the marker on its first line, so every run edits the same comment.
#
#   scripts/preview-comment.sh <pr> <body> [--update-only]
#
# --update-only edits an existing comment and never creates one: a pull request whose preview never
# deployed gets no comment saying it was deleted.
#
# Needs GH_TOKEN and GITHUB_REPOSITORY, as GitHub Actions provides them.
set -euo pipefail

readonly MARKER='<!-- livedoc-preview -->'
pr="${1:?pull request number}"
body="$(printf '%s\n%s' "$MARKER" "${2:?comment body}")"
mode="${3:-}"

id="$(gh api "repos/$GITHUB_REPOSITORY/issues/$pr/comments" --paginate \
  --jq "map(select(.body | startswith(\"$MARKER\"))) | .[0].id // empty")"
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" > /dev/null
  echo "[preview-comment] updated comment $id on #$pr"
elif [ "$mode" = --update-only ]; then
  echo "[preview-comment] #$pr has no preview comment to update"
else
  gh api "repos/$GITHUB_REPOSITORY/issues/$pr/comments" -f body="$body" > /dev/null
  echo "[preview-comment] created the preview comment on #$pr"
fi
