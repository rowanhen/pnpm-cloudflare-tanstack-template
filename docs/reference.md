# Code and API reference

[Start here](getting-started.md) · [Manual deployment](manual-deployment.md)

## Shared UI

Both apps use [`@leitware/composables`](https://www.npmjs.com/package/@leitware/composables), at 2.0.0 with the Kumo preset, with Tailwind CSS v4. Cards, inputs, labels, native selects, checkboxes, badges, alerts, separators, skeletons, stacks and typography come from the package's public entrypoint. The shared [shadcn/ui](https://ui.shadcn.com/docs/installation/tanstack) button remains source-owned for `asChild` link composition. Its styles use the same Composables semantic tokens and focus treatment. The MIT attribution is retained in `packages/shared/LICENSE.shadcn`.

Import UI from `@workspace/shared`; it re-exports the selected Composables components and the local button. Prefer public Composables components when extending the starter. Its `Card` owns its header and body: use `title`, `description`, `action`, and `footer` props, with `Stack` for body layout. Do not wrap children in another `CardContent`. The package includes a consumer guide at `node_modules/@leitware/composables/skills/use-composables/SKILL.md` relative to `packages/shared`.

`packages/shared/src/styles.css` imports the Tailwind adapter and compiled Composables stylesheet once, followed by `presets/kumo.css`. The preset supplies light/dark surfaces, blue actions and orange accents. Inter is self-hosted through `@fontsource-variable/inter`; the starter opens in light mode. Keep future overrides at this theme boundary. Stripe's Appearance API reads the same theme. The existing `components.json` files support adding a source-owned shadcn component when needed; align any generated styles with this theme.

Keep UI copy brief: labels identify fields, actions describe outcomes, and supporting text adds information needed to make a decision. Preserve consent, permissions, limits, one-time key warnings, and payment status. Put setup instructions and backend details in the docs.

Compose pages with `AppShell`, `MarketingShell`, and `PageState`. Reusable React hooks separate state from UI: `useHydrated`, `useWorkspace`, `useSignOut`, `useWaitlist`, `useCheckoutSession`, `useOrderStatus`, `useBilling`, and `useEmail`.

- Marketing `/waitlist/success` follows a successful database save, without exposing an email in the URL.
- Both apps return a custom **HTTP 404** for unknown paths.
- Root error boundaries show a safe custom error page with retry/home actions. `shellComponent` keeps the document and CSS intact when a route fails. `/error` previews that UI; the real boundary handles runtime failures and does not display internal error details.
- Checkout, order status, waitlist success, and error previews are noindexed. Only public marketing pages appear in the sitemap.

## Repository map

```text
apps/api/           Worker REST API, auth, rate limiting, D1 migrations, R2 binding
apps/dashboard/     Protected workspace, private todos/files, API key management
apps/marketing/     Waitlist, privacy example, SEO metadata, sitemap and robots
packages/data/      Drizzle schema, inferred database types and server-only D1 client
packages/contracts/ Shared Zod inputs, public DTOs and typed REST client
packages/shared/    Composables exports, shadcn button, theme, page states and shared hooks
packages/observability/ Consent, analytics, replay, error capture and API telemetry
scripts/            TypeScript setup/deploy commands and isolated local/cloud tests
```

Browsers call their own app's `/api` routes. The apps proxy to the configured Worker, keeping cookies on the dashboard domain and avoiding third-party cookies. In cloud deployments, they sign the original visitor IP with a separate shared `API_PROXY_SECRET`, so requests across Cloudflare zones retain individual rate limits. The Worker rejects forged or expired signatures. This secret grants no access to user data or sessions. Dashboard protection runs on the server before rendering, and the Worker independently authenticates and authorizes every private request. Private responses use `Cache-Control: no-store`.

The database contains users, linked Google accounts, sessions, OAuth verifications, todos, API key hashes, waitlist entries, and rate-limit counters, checkout orders, processed Stripe event IDs, credit balances, grants, and paid request receipts. Todos are filtered by the authenticated user's ID on every operation. R2 stores objects under a user-ID prefix and never exposes a public bucket. SQL uses prepared statements.

## REST API

Use the dashboard for cookie-authenticated operations. Session mutations also require a trusted `Origin` header. Errors use `{ "error": "..." }`; auth endpoints use Better Auth's response format.

| Method               | Route                             | Access / behavior                                                      |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| GET                  | `/api/health`                     | Public health check                                                    |
| GET                  | `/api/config`                     | Google, checkout and email configuration flags; no secrets             |
| POST                 | `/api/waitlist`                   | Public email/name/consent signup; generic 202 for duplicates           |
| GET / POST           | `/api/auth/*`                     | Better Auth sign-in, callback, session and sign-out handlers           |
| GET                  | `/api/me`                         | Signed-in user's profile                                               |
| GET                  | `/api/waitlist/me`                | Whether this user's verified email joined the waitlist                 |
| GET / POST           | `/api/todos`                      | List latest 100 own records / create `{ "title": "My idea" }`          |
| GET / PATCH / DELETE | `/api/todos/:id`                  | Read, edit title/completed, or delete own record                       |
| GET                  | `/api/files?limit=100&cursor=...` | Paginated own file metadata                                            |
| PUT                  | `/api/files/:key`                 | Upload/replace raw bytes in own namespace                              |
| GET / HEAD / DELETE  | `/api/files/:key`                 | Download, inspect metadata, or delete own file                         |
| GET / POST           | `/api/keys`                       | List own key metadata / create with `{ "name": "My script" }`          |
| DELETE               | `/api/keys/:id`                   | Revoke own API key immediately                                         |
| GET                  | `/api/v1/todos`                   | API key only: read that key owner's private records                    |
| POST                 | `/api/v1/summary`                 | `summary:read` key + UUID `Idempotency-Key`: 1 credit per new result   |
| GET                  | `/api/billing`                    | Session: own credit balance, prices, latest ten grants/debits          |
| GET                  | `/api/checkout/config`            | Session: test publishable key and server-selected offer                |
| POST                 | `/api/checkout/sessions`          | Session + Origin: create/reuse checkout with `{ "requestId": "UUID" }` |
| GET                  | `/api/checkout/sessions/:id`      | Session: verify and read only the caller's order                       |
| GET / POST           | `/api/email`                      | Session: own send history / send a test email to your verified address |
| POST                 | `/api/stripe/webhook`             | Stripe signature: verify and reconcile test checkout events            |

File limit: 5 MiB (buffered, including streamed uploads). Filenames: 1–200 letters, numbers, dots, underscores or hyphens, starting with a letter/number. Downloads use attachment disposition and `nosniff`. Titles: 200 characters. JSON limit: 16 KiB.

## API keys and rate limiting

Create a key in the signed-in dashboard and copy it once. Only its SHA-256 hash and display prefix are stored. Each user can have ten keys; keys do not expire automatically and can be deleted in the dashboard. Each key has one explicit scope. The default `todos:read` permits free access to its owner's todos:

```bash
export IDEA_API_KEY='paste-the-key-shown-once'
curl http://localhost:3001/api/v1/todos \
  -H "Authorization: Bearer $IDEA_API_KEY"
```

For the paid endpoint, create with `{ "name": "My paid client", "scope": "summary:read" }`, or choose Summary in the dashboard. A Summary key can spend its owner's credits on that endpoint; it cannot call the free todos endpoint. A Todo key cannot spend credits. Both are revocable, single-endpoint permissions.

API keys cannot create todos, access files, manage keys or billing, or read other users' data. The example uses one D1 database with explicit per-user isolation, rather than provisioning a database per user.

Each API key permits 30 requests per fixed minute per key and returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Excess requests return 429 and `Retry-After`. An atomic D1 upsert shares the counter across concurrent requests and Worker instances. Key creation permits ten attempts per minute per user. Public waitlist signup allows ten requests per hour per IP and three per email, with hashed limiter identifiers, a honeypot, validation, and explicit consent. Auth routes use Better Auth's database-backed limiter per IP and path: the base limit is 30 per minute, sign-in uses the library's stricter 3 per 10 seconds, and routine `/get-session` reads allow 120 per minute. Page guards use those reads on navigation. These are deliberately small example limits, configured in `apps/api/src/`.

## Waitlist and SEO

The marketing form saves a unique email, optional name, consent, and timestamp in D1. It sends a confirmation only when Cloudflare email is configured and exposes no public subscriber listing. The dashboard's Google sign-in is open to the Google audience you configure; the waitlist does not grant or restrict access.

Copy `apps/marketing/.env.example` to `.env.local` and customize:

```dotenv
VITE_API_URL=http://localhost:8787
VITE_SITE_NAME=My Idea
VITE_SITE_URL=http://localhost:3000
VITE_DASHBOARD_URL=http://localhost:3001
VITE_NOINDEX=true
```

Production builds need the final HTTPS URLs and `VITE_NOINDEX=false`. Localhost is always noindexed. Set `VITE_NOINDEX=true` explicitly for staging/preview builds; a production build copied to a preview URL still contains its production settings. `VITE_` values are public and embedded at build time.

The marketing site renders titles, descriptions, canonical URLs, Open Graph/Twitter metadata, a 1200×630 social image, WebSite JSON-LD, `/robots.txt`, and `/sitemap.xml` on the server. The dashboard is always noindexed. Update page copy in `apps/marketing/src/routes/`, defaults in `src/lib/seo.ts`, and `public/favicon.svg` for each new idea. Edit `scripts/generate-social-image.ts` and run `pnpm generate:social` to regenerate `public/og.png`. Add new public pages to the sitemap. The privacy page is example copy: replace its project/contact/retention details before collecting real signups.

PostHog analytics, masked session replay, browser/API errors and a reusable reporting dashboard are included. Run `pnpm posthog:setup` with a scoped management credential, then `pnpm cloud:up NAME`. See [observability setup and privacy defaults](observability.md).

## Dependency maintenance

Dependabot checks the pnpm workspace and GitHub Actions daily, including major releases. Its updates are grouped and queued for squash auto-merge; the required **Verify** check must pass first. That check covers formatting, lint, schema consistency, API tests, TypeScript, production builds and both browser suites. The merge workflow only enables GitHub auto-merge and never executes pull-request code.

The repository uses the newest supported pnpm 10 release because [Dependabot currently supports pnpm through v10](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories). Dependency versions are pinned in the lockfile; check for newer releases when upgrading. Scoped overrides in `pnpm-workspace.yaml` patch the esbuild bundled by Drizzle Kit's loader and Sharp used by Miniflare; remove them when upstream ranges include the fixes.

Run `pnpm -r outdated`, `pnpm audit`, and `pnpm dlx knip --dependencies` when reviewing upgrades. The dependency audit removed redundant app-level Tailwind declarations; the Vite plugin and shared stylesheet package own those dependencies. For a cloned repository, enable GitHub auto-merge and require **Verify** on the default branch before enabling the bot workflow.
