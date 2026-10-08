# pnpm-cloudflare-tanstack-template

A small starter for new ideas: a waitlist marketing site, Google sign-in, a protected TanStack Start dashboard, and a Cloudflare Worker REST API backed by D1 and R2. Users get private todos, files, revocable API keys, and prepaid API credits through an optional custom Stripe test checkout. A paid summary endpoint connects those examples into a reusable pay-per-request flow. Shared Composables and shadcn/ui components cover forms, loading/empty states, success, 404, and error pages. Drizzle owns the D1 schema and shares public types across the stack. Optional Cloudflare email sends waitlist confirmations and signed-in test emails.

Live example: [devtemplate.leitware.com](https://devtemplate.leitware.com).

## Agent setup and validation

Run `pnpm validate` to check the complete implementation locally without provider credentials. It runs API/setup tests, builds, and browser suites, using isolated auth/payment fixtures. Add `--cloud` for disposable Cloudflare E2E and provisioning/cleanup tests.

For an online sandbox, use `pnpm setup:doctor --online`, then `pnpm cloud:up my-demo`. With authorized Cloudflare credentials, the command creates resources, secrets, migrations, and deployments. Stripe test keys also enable automatic product/price/webhook setup. `pnpm cloud:check my-demo` checks the deployment; `pnpm cloud:down my-demo` deletes it, including uploaded files. It keeps environment configuration out of the tracked template.

[Agent setup guide](docs/agent-setup.md) covers credentials, repeatable commands, cleanup, and the remaining Google/Stripe/email account prerequisites. These commands cannot replace provider account signup, MFA, or Google's callback registration. A passing fixture test is separate from completing a real Google login or Stripe sandbox card payment.

## Start locally

Requires Node.js 22.12+ (CI uses Node 24) and pnpm 10.34.6.

Application code, configuration, setup/deployment scripts, and test fixtures are authored in TypeScript. Node commands run through [tsx](https://github.com/privatenumber/tsx), so no separate script build is needed. `pnpm typecheck` checks the apps, shared packages, Node tooling, Playwright tests and test Workers in their own runtime environments. It also rejects JavaScript source files added to the repository. Generated build output and dependencies still contain JavaScript; Git uses a minimal generated shell launcher for the TypeScript-backed checks.

```bash
git clone https://github.com/rowanhen/pnpm-cloudflare-tanstack-template.git
cd pnpm-cloudflare-tanstack-template
corepack enable
pnpm install
pnpm setup-project my-project # optional, before creating cloud resources
pnpm dev
```

Marketing runs at http://localhost:3000, the dashboard at http://localhost:3001, and the API at http://localhost:8787. `pnpm dev` generates a random local auth secret if absent, applies migrations, and starts all three apps. Local D1/R2 need no Cloudflare credentials and persist under `apps/api/.wrangler`. Vite development runs the frontend servers in Node; production builds and browser previews use Cloudflare Workers. This avoids Nitro’s development runner depending on a mismatched Miniflare API.

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

### Stripe test checkout

The signed-in dashboard has `/checkout` with a custom [Stripe Payment Element](https://docs.stripe.com/payments/quickstart?client=react) inside the app's shared UI. It uses Checkout Sessions (`ui_mode: elements`) for a **one-time test credit purchase**. `/checkout/success?session_id=...` checks the session on the server; visiting that URL alone never marks an order paid. It handles pending, incomplete, expired, missing, and confirmed orders.

1. In a dedicated Stripe sandbox, copy its **test** secret and publishable keys into the ignored `apps/api/.dev.vars`:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

2. Run `pnpm stripe:setup`. It creates a test **API credits** product and £12 one-time price, writes `STRIPE_PRICE_ID` locally, and saves an ignored resource manifest. It refuses to overwrite an existing price. The UI reads the product/price from Stripe, so you can replace `STRIPE_PRICE_ID` with your own active one-time test price.
3. Authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli) with `stripe login`, then run:

   ```bash
   stripe listen --forward-to localhost:8787/api/stripe/webhook
   ```

   Save the listener's signing secret as `STRIPE_WEBHOOK_SECRET=whsec_...` in `.dev.vars`. Restart `pnpm dev`. The listener must use the same sandbox as the keys.

4. Sign in with Google, open `/checkout`, choose **Continue to payment**, and use Stripe's [test cards](https://docs.stripe.com/testing): `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Also test a decline (`4000 0000 0000 0002`) and authentication (`4000 0025 0000 3155`). Only enter test details. Confirm that the success page adds 1,000 credits, refresh it, and check that the balance does not increase again.

No test keys are bundled with the template. It deliberately rejects live keys/events, restricts payment methods to cards, and disables adaptive pricing so the displayed and recorded currency match. Card details go directly to Stripe, never through the Worker or D1. Each verified purchase adds 1,000 API credits. The pack size is defined on the server in `apps/api/src/billing.ts`; new orders snapshot it before contacting Stripe.

**Cloud deployment:** configure `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` on the API Worker with `wrangler secret put`. For a new sandbox setup, `pnpm stripe:setup https://YOUR-API.workers.dev/api/stripe/webhook` also creates a signing endpoint and saves its secret locally. If reusing an existing price, add that webhook in Stripe's dashboard. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`, using API version `2026-09-30.endive`. Local listener and cloud endpoint signing secrets are different. The payment return URL derives from the Worker's `AUTH_URL`, which must be the canonical dashboard origin.

Checkout creation requires a signed-in cookie and trusted Origin, accepts only a UUID `requestId`, and always selects the price on the server. Repeated requests reuse the same order/session. Orders belong to one user, including on the status endpoint. Verified webhooks retrieve canonical Stripe state, validate owner/amount/currency, and record the paid order, unique credit grant, and balance increase in an atomic D1 batch. Repeated or reordered events cannot downgrade a paid order or grant credits twice, including when status polling races a webhook. If you add fulfilment side effects, use a transactional outbox keyed by order ID rather than executing them repeatedly in a webhook. Creation is limited to ten requests per minute per user; status checks to sixty.

To clean up resources created by the setup helper:

```bash
pnpm stripe:cleanup .wrangler/stripe-demo-RUN-ID.json
```

It archives the demo price/product, removes its webhook, and clears matching local bindings. It leaves unrelated resources untouched. Stripe retains individual test payment/session history; use a dedicated sandbox and remove that sandbox when finished rather than clearing a shared account's test data. Cleanup is retryable using the retained manifest if interrupted. Normal automated tests below create **no Stripe account resources**.

### Pay per request

The dashboard's **Add credits** checkout funds `POST /api/v1/summary`: a private todo summary costs one credit. Create a key with **Summary · 1 credit** access; free todo keys keep their existing permissions. D1 commits the result and debit together. A required `Idempotency-Key` prevents retry charges; an empty balance returns 402. The dashboard shows the balance, while `/api/billing` provides the latest grants and debits.

See [the pay-per-request guide](docs/pay-per-request.md) for a working curl example, the backend flow, pricing, retry semantics, Cloudflare infrastructure costs, and how to adapt the endpoint for another project.

### Drizzle and Cloudflare email

All D1 queries, including Better Auth, use Drizzle. `@workspace/data` exports the schema and inferred row/insert types; `@workspace/contracts` shares validated request schemas, public response types and a typed REST client with both frontends. Run `pnpm db:generate --name my_change` after changing the schema.

Email uses a native Worker binding, server-owned templates, D1 attempt records and duplicate-send protection. Set `EMAIL_FROM` for local simulation; `pnpm email:setup` and `pnpm cloud:up my-demo` configure live sending when your Cloudflare account/domain are ready. See [data, migration and email setup](docs/data-and-email.md).

### Shared frontend and reusable hooks

Both apps use [`@leitware/composables`](https://www.npmjs.com/package/@leitware/composables), at 2.0.0 with the Kumo preset, with Tailwind CSS v4. Cards, inputs, labels, native selects, checkboxes, badges, alerts, separators, skeletons, stacks and typography come from the package's public entrypoint. The shared [shadcn/ui](https://ui.shadcn.com/docs/installation/tanstack) button remains source-owned for `asChild` link composition. Its styles use the same Composables semantic tokens and focus treatment. The MIT attribution is retained in `packages/shared/LICENSE.shadcn`.

Import UI from `@workspace/shared`; it re-exports the selected Composables components and the local button. Prefer public Composables components when extending the starter. Its `Card` owns its header and body: use `title`, `description`, `action`, and `footer` props, with `Stack` for body layout. Do not wrap children in another `CardContent`. The package includes a consumer guide at `node_modules/@leitware/composables/skills/use-composables/SKILL.md` relative to `packages/shared`.

`packages/shared/src/styles.css` imports the Tailwind adapter and compiled Composables stylesheet once, followed by `presets/kumo.css`. The preset supplies light/dark surfaces, blue actions and orange accents. Inter is self-hosted through `@fontsource-variable/inter`; the starter opens in light mode. Keep future overrides at this theme boundary. Stripe's Appearance API reads the same theme. The existing `components.json` files support adding a source-owned shadcn component when needed; align any generated styles with this theme.

Keep UI copy brief: labels identify fields, actions describe outcomes, and supporting text adds information needed to make a decision. Preserve consent, permissions, limits, one-time key warnings, and payment status. Put setup instructions and explanations of the backend in this README.

Compose pages with `AppShell`, `MarketingShell`, and `PageState`. Reusable React hooks separate state from UI: `useHydrated`, `useWorkspace`, `useSignOut`, `useWaitlist`, `useCheckoutSession`, `useOrderStatus`, `useBilling`, and `useEmail`.

- Marketing `/waitlist/success` follows a successful database save, without exposing an email in the URL.
- Both apps return a custom **HTTP 404** for unknown paths.
- Root error boundaries show a safe custom error page with retry/home actions. `shellComponent` keeps the document and CSS intact when a route fails. `/error` previews that UI; the real boundary handles runtime failures and does not display internal error details.
- Checkout, order status, waitlist success, and error previews are noindexed. Only public marketing pages appear in the sitemap.

## What is included

```text
apps/api/           Worker REST API, auth, rate limiting, D1 migrations, R2 binding
apps/dashboard/     Protected workspace, private todos/files, API key management
apps/marketing/     Waitlist, privacy example, SEO metadata, sitemap and robots
packages/data/      Drizzle schema, inferred database types and server-only D1 client
packages/contracts/ Shared Zod inputs, public DTOs and typed REST client
packages/shared/    Composables exports, shadcn button, theme, page states and shared hooks
scripts/            TypeScript setup/deploy commands and isolated local/cloud tests
```

Browsers call their own app's `/api` routes. The apps proxy to the configured Worker, keeping cookies on the dashboard domain and avoiding third-party cookies. In cloud deployments, they sign the original visitor IP with a separate shared `API_PROXY_SECRET`, so requests across Cloudflare zones retain individual rate limits. The Worker rejects forged or expired signatures. This secret grants no access to user data or sessions. Dashboard protection runs on the server before rendering, and the Worker independently authenticates and authorizes every private request. Private responses use `Cache-Control: no-store`.

The database contains users, linked Google accounts, sessions, OAuth verifications, todos, API key hashes, waitlist entries, and rate-limit counters, checkout orders, processed Stripe event IDs, credit balances, grants, and paid request receipts. Todos are filtered by the authenticated user's ID on every operation. R2 stores objects under a user-ID prefix and never exposes a public bucket. SQL uses prepared statements.

### REST API

Use the dashboard for cookie-authenticated operations. Session mutations also require a trusted `Origin` header. Errors use `{ "error": "..." }`; auth endpoints use Better Auth's response format.

| Method               | Route                             | Access / behavior                                                      |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| GET                  | `/api/health`                     | Public health check                                                    |
| GET                  | `/api/config`                     | Whether Google is configured; no credentials                           |
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
| POST                 | `/api/stripe/webhook`             | Stripe signature: verify and reconcile test checkout events            |

File limit: 5 MiB (buffered, including streamed uploads). Filenames: 1–200 letters, numbers, dots, underscores or hyphens, starting with a letter/number. Downloads use attachment disposition and `nosniff`. Titles: 200 characters. JSON limit: 16 KiB.

### API keys and rate limiting

Create a key in the signed-in dashboard and copy it once. Only its SHA-256 hash and display prefix are stored. Each user can have ten keys; keys do not expire automatically and can be deleted in the dashboard. Each key has one explicit scope. The default `todos:read` permits free access to its owner's todos:

```bash
export IDEA_API_KEY='paste-the-key-shown-once'
curl http://localhost:3001/api/v1/todos \
  -H "Authorization: Bearer $IDEA_API_KEY"
```

For the paid endpoint, create with `{ "name": "My paid client", "scope": "summary:read" }`, or choose Summary in the dashboard. A Summary key can spend its owner's credits on that endpoint; it cannot call the free todos endpoint. A Todo key cannot spend credits. Both are revocable, single-endpoint permissions.

API keys cannot create todos, access files, manage keys or billing, or read other users' data. The example uses one D1 database with explicit per-user isolation, rather than provisioning a database per user.

Each API key permits 30 requests per fixed minute per key and returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Excess requests return 429 and `Retry-After`. An atomic D1 upsert shares the counter across concurrent requests and Worker instances. Key creation permits ten attempts per minute per user. Public waitlist signup allows ten requests per hour per IP and three per email, with hashed limiter identifiers, a honeypot, validation, and explicit consent. Auth routes also use Better Auth's database-backed rate limiter. These are deliberately small example limits, configured in `apps/api/src/`.

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

The marketing site renders titles, descriptions, canonical URLs, Open Graph/Twitter metadata, a 1200×630 social image, WebSite JSON-LD, `/robots.txt`, and `/sitemap.xml` on the server. The dashboard is always noindexed. Update page copy in `apps/marketing/src/routes/`, defaults in `src/lib/seo.ts`, and `public/favicon.svg` for each new idea. Edit `scripts/generate-social-image.ts` and run `pnpm generate:social` to regenerate `public/og.png`. Add new public pages to the sitemap. The privacy page is example copy: replace its project/contact/retention details before collecting real signups.

PostHog analytics, masked session replay, browser/API errors and a reusable reporting dashboard are included. Run `pnpm posthog:setup` with a scoped management credential, then `pnpm cloud:up NAME`. See [observability setup and privacy defaults](docs/observability.md).

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

Local tests create isolated temporary storage, apply all migrations, and seed two test users and signed sessions directly in that test database. No fixture user or login bypass is deployed by the application. They cover expired/tampered sessions, OAuth initiation/PKCE and callback rejection, server-protected routing, sign-out, private D1/R2 CRUD, cross-user isolation, API-key reveal/revocation/scope, concurrent rate limiting, signed proxy IP isolation, waitlist submission, and rendered SEO. Stripe contract tests run the real SDK and signature verifier against an isolated local HTTP fixture, testing server-selected pricing, idempotency, ownership, forged/replayed webhooks, amount checks, order reconciliation, and exactly-once credit grants across concurrent webhooks/status checks. Metering tests cover atomic debit/rollback, concurrent retries across keys, input conflicts, the last-credit race, balance exhaustion, and revoked-key replay. The temporary test Worker redirects only Stripe API requests to this fixture and can inject a session-service failure for the error-boundary test; neither capability exists in the deployed Worker. Browser tests cover checkout status/recovery, waitlist success, 404 status codes, actual error-boundary recovery, mobile layouts, and both production app builds in the Pages runtime and Vite development servers, including compressed responses and streamed uploads. Local storage and child processes are cleaned up afterward.

**Stripe test boundary:** automated tests do not complete a real Stripe Payment Element card payment or 3DS challenge. Follow the manual sandbox checkout above to verify that final integration. Stripe account credentials are not needed by CI. Cloud tests skip the local Stripe fixture cases.

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

## Dependency maintenance

Dependabot checks the pnpm workspace and GitHub Actions daily, including major releases. Its updates are grouped and queued for squash auto-merge; the required **Verify** check must pass first. That check covers formatting, lint, schema consistency, API tests, TypeScript, production builds and both browser suites. The merge workflow only enables GitHub auto-merge and never executes pull-request code.

The repository uses the newest supported pnpm 10 release because [Dependabot currently supports pnpm through v10](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories). Application dependencies use their latest releases. Scoped overrides in `pnpm-workspace.yaml` patch the esbuild bundled by Drizzle Kit's loader and Sharp used by Miniflare; remove them when upstream ranges include the fixes.

Run `pnpm -r outdated`, `pnpm audit`, and `pnpm dlx knip --dependencies` when reviewing upgrades. The dependency audit removed redundant app-level Tailwind declarations; the Vite plugin and shared stylesheet package own those dependencies. For a cloned repository, enable GitHub auto-merge and require **Verify** on the default branch before enabling the bot workflow.
