#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
PROJECT_NAME="$(node -p 'require("./package.json").name')"
APP="${1:-all}"
case "$APP" in all|marketing|dashboard) ;; *) echo 'Usage: pnpm deploy [marketing|dashboard]'; exit 1 ;; esac
if [[ -z "${VITE_API_URL:-}" ]]; then
  echo 'Set VITE_API_URL to your deployed API Worker URL before deploying the apps.'
  exit 1
fi
if [[ "$APP" == all ]]; then
  pnpm db:migrate:remote
  pnpm deploy:api
fi
for app in marketing dashboard; do
  if [[ "$APP" == all || "$APP" == "$app" ]]; then
    pnpm --filter "$app" build
    (cd "apps/$app" && pnpm exec wrangler pages deploy dist --project-name "${PROJECT_NAME}-${app}" --branch main)
  fi
done
