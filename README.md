# pnpm-cloudflare-tanstack-template

A small starter for new ideas: a waitlist marketing site, Google sign-in, a protected TanStack Start dashboard, and a Cloudflare Worker REST API backed by D1 and R2. Users get private todos, files, and revocable API keys. No Convex, payment integration, or email delivery service is required.

## Start locally

Requires Node.js 22.12+ (CI uses Node 24) and pnpm 10.18.0.

```bash
git clone https://github.com/rowanhen/pnpm-cloudflare-tanstack-template.git
cd pnpm-cloudflare-tanstack-template
pnpm install
pnpm setup-project my-project # optional, before creating cloud resources
pnpm dev
```

Marketing runs at http://localhost:3000, the dashboard at http://localhost:3001, and the API at http://localhost:8787. `pnpm dev` generates a random local auth secret if absent, applies migrations, and starts all three apps. Local D1/R2 need no Cloudflare credentials and persist under `apps/api/.wrangler`.

The waitlist works immediately. Dashboard sign-in requires your Google OAuth client; there is no development auth bypass. The login page explains when Google is unconfigured. Automated tests work without a Google account.

### Google sign-in

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), configure branding and audience, then create an OAuth client of type **Web application**. For a project in Testing, add your Google account as a test user. Only basic identity scopes (`openid`, `email`, `profile`) are requested.
2. Add the JavaScript origin `http://localhost:3001` and exact authorized redirect URI `http://localhost:3001/api/auth/callback/google`.
3. Run `pnpm setup:local` if needed, then add these two values to the generated, gitignored `apps/api/.dev.vars`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

   Keep the generated `BETTER_AUTH_SECRET`. `.dev.vars.example` documents all three values. Never put secrets in `VITE_` variables.

4. Restart `pnpm dev`, open the dashboard, and choose **Continue with Google**. First sign-in creates a D1 user and account; subsequent sign-ins reuse that identity. Signing out deletes the server session.

[Better Auth](https://www.better-auth.com/docs/authentication/google) handles OAuth state, PKCE, encrypted provider tokens, and signed HttpOnly session cookies. Sessions live in D1, expire after seven days, and use Secure cookies with HTTPS and SameSite=Lax. Password signup and automatic account linking are disabled. `AUTH_URL` is the **dashboard origin**, because its same-origin `/api/*` proxy handles the OAuth callback and cookies. It is not the API Worker's URL. Use one canonical dashboard origin per environment.

## What is included

```text
apps/api/           Worker REST API, auth, rate limiting, D1 migrations, R2 binding
apps/dashboard/     Protected workspace, private todos/files, API key management
apps/marketing/     Waitlist, privacy example, SEO metadata, sitemap and robots
packages/shared/    Project metadata and shared UI
scripts/            Setup/deploy commands and isolated local/cloud tests
```

Browsers call their own app's `/api` routes. The apps proxy to the configured Worker, keeping cookies on the dashboard domain and avoiding third-party cookies. In cloud deployments, they sign the original visitor IP with a separate shared `API_PROXY_SECRET`, so requests across Cloudflare zones retain individual rate limits. The Worker rejects forged or expired signatures. This secret grants no access to user data or sessions. Dashboard protection runs on the server before rendering, and the Worker independently authenticates and authorizes every private request. Private responses use `Cache-Control: no-store`.

The database contains users, linked Google accounts, sessions, OAuth verifications, todos, API key hashes, waitlist entries, and rate-limit counters. Todos are filtered by the authenticated user's ID on every operation. R2 stores objects under a user-ID prefix and never exposes a public bucket. SQL uses prepared statements.

### REST API

Use the dashboard for cookie-authenticated operations. Session mutations also require a trusted `Origin` header. Errors use `{ "error": "..." }`; auth endpoints use Better Auth's response format.

| Method               | Route                             | Access / behavior                                             |
| -------------------- | --------------------------------- | ------------------------------------------------------------- |
| GET                  | `/api/health`                     | Public health check                                           |
| GET                  | `/api/config`                     | Whether Google is configured; no credentials                  |
| POST                 | `/api/waitlist`                   | Public email/name/consent signup; generic 202 for duplicates  |
| GET / POST           | `/api/auth/*`                     | Better Auth sign-in, callback, session and sign-out handlers  |
| GET                  | `/api/me`                         | Signed-in user's profile                                      |
| GET                  | `/api/waitlist/me`                | Whether this user's verified email joined the waitlist        |
| GET / POST           | `/api/todos`                      | List latest 100 own records / create `{ "title": "My idea" }` |
| GET / PATCH / DELETE | `/api/todos/:id`                  | Read, edit title/completed, or delete own record              |
| GET                  | `/api/files?limit=100&cursor=...` | Paginated own file metadata                                   |
| PUT                  | `/api/files/:key`                 | Upload/replace raw bytes in own namespace                     |
| GET / HEAD / DELETE  | `/api/files/:key`                 | Download, inspect metadata, or delete own file                |
| GET / POST           | `/api/keys`                       | List own key metadata / create with `{ "name": "My script" }` |
| DELETE               | `/api/keys/:id`                   | Revoke own API key immediately                                |
| GET                  | `/api/v1/todos`                   | API key only: read that key owner's private records           |

File limit: 5 MiB (buffered, including streamed uploads). Filenames: 1–200 letters, numbers, dots, underscores or hyphens, starting with a letter/number. Downloads use attachment disposition and `nosniff`. Titles: 200 characters. JSON limit: 16 KiB.

### API keys and rate limiting

Create a key in the signed-in dashboard and copy it once. Only its SHA-256 hash and display prefix are stored. Each user can have ten keys; keys do not expire automatically and can be deleted in the dashboard. Their only scope is reading their owner's todos through one endpoint:

```bash
export IDEA_API_KEY='paste-the-key-shown-once'
curl http://localhost:3001/api/v1/todos \
  -H "Authorization: Bearer $IDEA_API_KEY"
```

API keys cannot create records, access files, manage keys, or read other users' data. The example uses one D1 database with explicit per-user isolation, rather than provisioning a database per user.

The API-key endpoint permits 30 requests per fixed minute per key and returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Excess requests return 429 and `Retry-After`. An atomic D1 upsert shares the counter across concurrent requests and Worker instances. Key creation permits ten attempts per minute per user. Public waitlist signup allows ten requests per hour per IP and three per email, with hashed limiter identifiers, a honeypot, validation, and explicit consent. Auth routes also use Better Auth's database-backed rate limiter. These are deliberately small example limits, configured in `apps/api/src/`.

### Waitlist and SEO

The marketing form saves a unique email, optional name, consent, and timestamp in D1. It sends no email and exposes no public subscriber listing. The dashboard's Google sign-in is open to the Google audience you configure; the waitlist does not grant or restrict access.

Copy `apps/marketing/.env.example` to `.env.local` and customize:

```dotenv
VITE_API_URL=http://localhost:8787
VITE_SITE_NAME=My Idea
VITE_SITE_URL=http://localhost:3000
VITE_DASHBOARD_URL=http://localhost:3001
VITE_NOINDEX=true
```

Production builds need the final HTTPS URLs and `VITE_NOINDEX=false`. Localhost is always noindexed. Set `VITE_NOINDEX=true` explicitly for staging/preview builds; a production build copied to a preview URL still contains its production settings. `VITE_` values are public and embedded at build time.

The marketing site renders titles, descriptions, canonical URLs, Open Graph/Twitter metadata, a 1200×630 social image, WebSite JSON-LD, `/robots.txt`, and `/sitemap.xml` on the server. The dashboard is always noindexed. Update page copy in `apps/marketing/src/routes/`, defaults in `src/lib/seo.ts`, and `public/og.png`/`favicon.svg` for each new idea. Add new public pages to the sitemap. The privacy page is example copy: replace its project/contact/retention details before collecting real signups.

## Deploy

Authenticate with `pnpm exec wrangler login`, or export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. API provisioning needs D1, Workers R2 Storage, and Workers Scripts Edit permissions; app deployment also needs Cloudflare Pages Edit.

1. Choose names (`pnpm setup-project my-project`), then provision:

   ```bash
   pnpm exec wrangler d1 create my-project-db --config apps/api/wrangler.json
   pnpm exec wrangler r2 bucket create my-project-files
   pnpm exec wrangler pages project create my-project-marketing --production-branch main
   pnpm exec wrangler pages project create my-project-dashboard --production-branch main
   ```

2. In `apps/api/wrangler.json`, set the returned D1 `database_id` and matching resource names. The all-zero UUID is local only. Set `AUTH_URL` to `https://my-project-dashboard.pages.dev` (or your custom dashboard domain), and `ALLOWED_ORIGINS` to the exact marketing/dashboard origins, comma separated, without trailing slashes.
3. Add the production dashboard origin and `https://my-project-dashboard.pages.dev/api/auth/callback/google` redirect URI to Google. Use separate OAuth clients and Cloudflare resources for development and production.
4. Apply migrations, deploy, then configure Worker secrets using the interactive prompts:

   ```bash
   pnpm db:migrate:remote
   pnpm deploy:api
   pnpm exec wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.json
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config apps/api/wrangler.json
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config apps/api/wrangler.json
   ```

   Generate a fresh secret with `openssl rand -hex 32`; keep it in your password manager. Do not reuse the local secret. Auth fails closed until configured.

5. Generate another random secret for `API_PROXY_SECRET`. Set the **same value** on the API Worker and both Pages projects (production and corresponding preview settings if used):

   ```bash
   pnpm exec wrangler secret put API_PROXY_SECRET --config apps/api/wrangler.json
   pnpm exec wrangler pages secret put API_PROXY_SECRET --project-name my-project-dashboard
   pnpm exec wrangler pages secret put API_PROXY_SECRET --project-name my-project-marketing
   ```

   Keep this separate from `BETTER_AUTH_SECRET`. It is read from Pages runtime bindings, never from `VITE_` variables. Local development against localhost skips proxy signing; the isolated test runner supplies its own temporary secret.

6. Export the build configuration and deploy both apps:

   ```bash
   export VITE_API_URL=https://my-project-api.YOUR-SUBDOMAIN.workers.dev
   export VITE_SITE_URL=https://my-project-marketing.pages.dev
   export VITE_DASHBOARD_URL=https://my-project-dashboard.pages.dev
   export VITE_SITE_NAME='My Idea'
   export VITE_NOINDEX=false
   pnpm deploy
   ```

`pnpm deploy` migrates/deploys the API and uploads both app builds to Pages. `pnpm deploy:marketing` and `pnpm deploy:dashboard` deploy individual apps. The build output is `dist/`. Terraform can own Pages projects, domains, and DNS while these commands upload builds. Avoid wildcard trusted origins; each deployment should have its own OAuth callback and auth secret.

After deployment, complete a real Google sign-in, confirm your profile/todo/file persist, create and revoke a key, and sign out. Automated tests below do not authenticate with Google's live consent screen.

For schema changes, add numbered SQL files in `apps/api/migrations/`. The auth schema matches the installed Better Auth version; review its migration output when upgrading. Migration 0003 preserves old anonymous demo todos with no owner, making them inaccessible to signed-in users. Old unprefixed R2 objects are also inaccessible; deliberately migrate or delete that legacy demo data. D1 rate-limit rows are reused per identifier; periodically remove stale counters and expired auth records for a long-lived deployment.

## Verification and cleanup

```bash
pnpm check                         # lint, formatting, API E2E, types, production builds
pnpm exec playwright install chromium
pnpm test:browser                  # production Pages apps → Worker → local D1/R2
pnpm test:dev                      # Vite development apps → Worker → local D1/R2
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm test:remote
```

Local tests create isolated temporary storage, apply all migrations, and seed two test users and signed sessions directly in that test database. No fixture user or login bypass is deployed by the application. They cover expired/tampered sessions, OAuth initiation/PKCE and callback rejection, server-protected routing, sign-out, private D1/R2 CRUD, cross-user isolation, API-key reveal/revocation/scope, concurrent rate limiting, signed proxy IP isolation, waitlist submission, and rendered SEO. Browser tests cover both production app builds in the Pages runtime and Vite development servers, including compressed responses and streamed uploads. Local storage and child processes are cleaned up afterward.

**Google test boundary:** tests use dummy OAuth client credentials and verify the redirect to Google. They do not complete Google's consent, code exchange, or first-user creation. Real sign-in needs your configured OAuth client and an interactive Google account. The manual deployment check above covers that final integration.

`pnpm test:remote` creates uniquely named `template-e2e-*` Worker, D1, R2 and two Pages projects, seeds the same test sessions, and runs the API suite plus Chromium against the fully deployed HTTPS apps. It needs Pages Edit permission too. Temporary marketing deployments are noindexed. Local browser tests need ports 8787, 3000 and 3001 free. No persistent demo users, test keys, subscriptions, or cloud deployments are left by the tests.

Cleanup runs in `finally` and on SIGINT/SIGTERM, deletes both Pages projects and test objects/bucket/database/Worker, and independently checks resource absence. A manifest is written before provisioning. If the machine loses power, the process is forcibly killed, or cleanup fails, recover with the same account credentials:

```bash
pnpm test:remote --cleanup .wrangler/template-e2e-RUN-ID/resources.json
```

The manifest stays until cleanup is verified. Cloud resources can incur small usage charges while they exist. Remote tests never use the normal application's resource names.

GitHub Actions runs `pnpm check` and Chromium tests on main and pull requests without cloud secrets. Remote testing is explicit. `pnpm install` installs the local pre-commit check hook.

## References

- [Better Auth Google provider](https://www.better-auth.com/docs/authentication/google)
- [Cloudflare subrequest IP behavior](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip-in-worker-subrequests)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [R2 Worker binding API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [TanStack Start authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)
