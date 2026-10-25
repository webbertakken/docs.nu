#!/usr/bin/env bash
# Deploys docs.nu from a local checkout, in the order deploy-reusable.yml uses:
# build, D1 migrations, the api, the downstream apps, then the router that binds
# them. The hosted profile (apps/api/hosted-vars.json) rides along exactly as in
# the workflow: its build-time twins on the build, its vars on the api, verified
# on the live worker afterwards.
#
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"

repo_root="$(git rev-parse --show-toplevel)"
build_id="$(git rev-parse HEAD)"
cd "$repo_root"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy-docs-nu] refusing to deploy: the working tree has uncommitted changes" >&2
  exit 1
fi

deploy() {
  local app="$1"
  shift
  echo "[deploy-docs-nu] deploying $app"
  (cd "apps/$app" && pnpm exec wrangler deploy "$@")
}

mapfile -t build_env < <(cd apps/api && node scripts/hosted-vars.mjs build-env)
mapfile -t hosted_flags < <(cd apps/api && node scripts/hosted-vars.mjs flags)

echo "[deploy-docs-nu] building $build_id with: ${build_env[*]}"
env "${build_env[@]}" NEXT_PUBLIC_MCP_ORIGIN=https://mcp.docs.nu NEXT_PUBLIC_BUILD_ID="$build_id" pnpm build

echo "[deploy-docs-nu] applying D1 migrations"
(cd apps/api && pnpm exec wrangler d1 migrations apply DB --remote)

deploy api "${hosted_flags[@]}" --var "BUILD_ID:$build_id"
(cd apps/api && node scripts/hosted-vars.mjs verify)
for app in marketing telemetry help live community; do
  deploy "$app"
done
deploy router

echo "[deploy-docs-nu] done: $build_id is live on https://docs.nu"
