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
if [[ "$APP" == all || "$APP" == marketing ]]; then
  if [[ -z "${VITE_SITE_URL:-}" || -z "${VITE_DASHBOARD_URL:-}" || -z "${VITE_NOINDEX:-}" ]]; then
    echo 'Set VITE_SITE_URL, VITE_DASHBOARD_URL and VITE_NOINDEX (true for previews, false for production).'
    exit 1
  fi
fi
if [[ "$APP" == all ]]; then
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const config = JSON.parse(readFileSync("apps/api/wrangler.json", "utf8"));
    if (config.vars.AUTH_URL !== process.env.VITE_DASHBOARD_URL || !config.vars.AUTH_URL.startsWith("https://")) {
      throw new Error("Set AUTH_URL in apps/api/wrangler.json to the HTTPS VITE_DASHBOARD_URL before deployment.");
    }
  '

  pnpm db:migrate:remote
  pnpm deploy:api
fi
for app in marketing dashboard; do
  if [[ "$APP" == all || "$APP" == "$app" ]]; then
    pnpm --filter "$app" build
    (cd "apps/$app" && pnpm exec wrangler pages deploy dist --project-name "${PROJECT_NAME}-${app}" --branch main)
  fi
done
