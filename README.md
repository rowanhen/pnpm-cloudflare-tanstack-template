# pnpm-cloudflare-tanstack-template

A pnpm monorepo with two TanStack Start apps, a Cloudflare Worker REST API, D1 SQL storage, and R2 object storage. The dashboard contains working todo and file examples. Local development needs no cloud credentials.

## Quick start

Requires Node.js 22.12+ (CI uses Node 24) and pnpm 10.18.0.

```bash
git clone https://github.com/rowanhen/pnpm-cloudflare-tanstack-template.git
cd pnpm-cloudflare-tanstack-template
pnpm install
# Optional: rename package, UI copy and Worker/D1/R2 names before provisioning.
pnpm setup-project my-project
pnpm dev
```

Open the dashboard at http://localhost:3001 to add, complete, and delete todos and upload, download, and delete files. Marketing runs on port 3000; the Worker runs on port 8787. `pnpm dev` applies D1 migrations before starting all three servers. D1 and R2 persist locally under `apps/api/.wrangler`; stopping development creates or deletes no cloud resources.

The apps default to `http://localhost:8787`. Copy an app's `.env.example` to `.env.local` to override `VITE_API_URL`. Vite reads these files per app. `VITE_` values are public and embedded at build time; never place tokens there.

## Layout

```text
apps/api/           Worker REST API, Wrangler config and SQL migrations
apps/dashboard/     Interactive D1 and R2 examples (TanStack Start)
apps/marketing/     Starter marketing app (TanStack Start)
packages/shared/    Shared UI and project metadata
scripts/            Setup, deployment and isolated end-to-end tests
tests/              Dashboard browser tests
```

The browser calls the Worker using fetch and TanStack Query. The Worker uses prepared D1 statements and the R2 binding directly. Apps deploy to Cloudflare Pages; the API deploys as a Worker. Bindings and credentials stay on the server.

## REST examples

All resource routes return JSON errors as `{ "error": "..." }`. Cloud deployments require `Authorization: Bearer <API_TOKEN>`. Local `pnpm dev` explicitly disables authentication. `/api/health` is public. The API fails closed with HTTP 503 if authentication is enabled without a token.

| Method     | Route                             | Behavior                                           |
| ---------- | --------------------------------- | -------------------------------------------------- |
| GET        | `/api/health`                     | Health check                                       |
| GET        | `/api/todos`                      | Latest 100 todos                                   |
| POST       | `/api/todos`                      | Create with `{ "title": "Buy milk" }`              |
| GET        | `/api/todos/:id`                  | Read one todo                                      |
| PATCH      | `/api/todos/:id`                  | Change `title` and/or boolean `completed`          |
| DELETE     | `/api/todos/:id`                  | Delete; 204 or 404 if absent                       |
| GET        | `/api/files?limit=100&cursor=...` | List metadata; follow returned `cursor` until null |
| PUT        | `/api/files/:key`                 | Upload raw bytes; replace an existing key          |
| GET / HEAD | `/api/files/:key`                 | Download / inspect metadata, ETag and content type |
| DELETE     | `/api/files/:key`                 | Idempotent delete; 204                             |

Titles are trimmed and limited to 200 characters. JSON bodies are limited to 16 KiB. Files are limited to 5 MiB, including streamed uploads; this starter buffers uploads to enforce the limit. Filenames must start with a letter or number and contain only letters, numbers, dots, underscores or hyphens (maximum 200 characters). Downloads use attachment disposition and `nosniff`.

```bash
API=http://localhost:8787
curl "$API/api/todos" -H 'Content-Type: application/json' \
  -d '{"title":"Try D1"}'
# Use the returned todo.id:
curl "$API/api/todos/TODO_ID" -X PATCH -H 'Content-Type: application/json' \
  -d '{"completed":true}'
curl "$API/api/todos"
curl "$API/api/todos/TODO_ID" -X DELETE

printf 'Hello R2!\n' > /tmp/example.txt
curl "$API/api/files/example.txt" -X PUT -H 'Content-Type: text/plain' \
  --data-binary @/tmp/example.txt
curl "$API/api/files"
curl "$API/api/files/example.txt" -o /tmp/downloaded-example.txt
cmp /tmp/example.txt /tmp/downloaded-example.txt
curl "$API/api/files/example.txt" -X DELETE
rm /tmp/example.txt /tmp/downloaded-example.txt
```

For cloud requests, add `-H "Authorization: Bearer $API_TOKEN"` to each resource request. Enter the same token into the dashboard's token field; it is kept only in memory. This shared token is a basic demonstration, not a multi-user identity system. Replace it with your application's authorization before exposing private user data.

## Deploy your own resources

Authenticate with `pnpm exec wrangler login`, or export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token needs account permissions for D1, Workers R2 Storage, and Workers Scripts (Edit); Pages deployment also needs Cloudflare Pages (Edit).

1. Choose names with `pnpm setup-project my-project` before creating resources.
2. Create D1 and R2:

   ```bash
   pnpm exec wrangler d1 create my-project-db --config apps/api/wrangler.json
   pnpm exec wrangler r2 bucket create my-project-files
   ```

3. Put the returned D1 UUID into `apps/api/wrangler.json` (`database_id`). Ensure the database and bucket names match your new resources. The committed all-zero UUID is for local development only.
4. Set `ALLOWED_ORIGINS` in that config to the exact dashboard/marketing origins (comma separated, no trailing slash). Keep `REQUIRE_AUTH` set to `"true"`. Localhost origins can remain for local UI testing against your cloud API.
5. Apply migrations, deploy the API, and set its secret:

   ```bash
   pnpm db:migrate:remote
   pnpm deploy:api
   pnpm exec wrangler secret put API_TOKEN --config apps/api/wrangler.json
   ```

   Until the secret is set, resource requests return 503. The deployment output gives your `https://my-project-api.<subdomain>.workers.dev` URL.

6. Create the Pages projects using your infrastructure repo or the CLI:

   ```bash
   pnpm exec wrangler pages project create my-project-marketing --production-branch main
   pnpm exec wrangler pages project create my-project-dashboard --production-branch main
   export VITE_API_URL=https://my-project-api.YOUR-SUBDOMAIN.workers.dev
   pnpm deploy
   ```

`pnpm deploy` migrates/deploys the API, builds both apps with the exported API URL, and uploads them to Pages. `pnpm deploy:marketing` and `pnpm deploy:dashboard` deploy individual apps. Set CORS origins to `https://my-project-dashboard.pages.dev`, `https://my-project-marketing.pages.dev`, or your custom domains. Terraform can continue owning Pages project/domain/DNS resources; these scripts only upload app builds to existing projects.

The dashboard uses a standard TanStack Query provider for client-side REST requests. It does not stream query-cache functions into the HTML, keeping hydration compatible with the Pages bundler.

Add subsequent SQL changes as numbered files in `apps/api/migrations/`, then run `pnpm db:migrate` locally and `pnpm db:migrate:remote` when deploying. Keep development, staging and production resources separate.

## Tests and cleanup

```bash
pnpm check                         # lint, formatting, REST E2E, types, production builds
pnpm exec playwright install chromium
pnpm test:browser                  # real browser → Worker → local D1/R2
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm test:remote
```

`pnpm test` starts a real local Workers runtime with isolated temporary storage and applies the migration. It tests D1 CRUD, R2 text/binary/empty uploads, replacement, download bytes and metadata, listing/pagination, deletion, body limits, invalid requests, missing records, CORS and bearer authentication. It stops the Worker and removes its temporary D1/R2 storage in `finally`.

Browser tests build the dashboard and serve its production output with the Pages runtime alongside the local API, verify todo persistence across reload, compare downloaded file contents, and delete their own records/files afterward. Ports 8787, 3000 and 3001 must be free (the remote test only needs 3000 and 3001). The browser runner leaves only the reusable local schema/cache in `apps/api/.wrangler`; it creates no cloud resources.

`pnpm test:remote` requires API-token authentication and R2 enabled on the account. It creates uniquely named `template-e2e-*` resources, applies the migration, deploys a Worker with a random secret, and exercises the same REST suite over HTTPS. Cleanup runs on success, errors, SIGINT and SIGTERM, deletes test objects, the R2 bucket, D1 database and Worker, and verifies their absence. It also runs the production dashboard in Chromium against the live cloud API and checks the marketing page. Install Chromium first as shown above. It never uses the normal deployment's database/bucket names.

A cleanup manifest is saved before provisioning under `.wrangler/template-e2e-*/resources.json`. If the process is forcibly killed, the machine loses power, or cleanup fails, recover with the same account credentials:

```bash
pnpm test:remote --cleanup .wrangler/template-e2e-RUN-ID/resources.json
```

The manifest is retained on incomplete cleanup and removed once absence is verified. Test resources may incur small Cloudflare usage charges while they exist.

GitHub Actions runs `pnpm check` and the Chromium browser test on pushes to `main` and pull requests, with no cloud secrets required. Remote E2E is explicit to avoid creating billable resources on every commit. `pnpm install` installs the local pre-commit check hook.

## References

- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [R2 Worker binding API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
