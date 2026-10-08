# Set up and validate with an agent

New to the repository? Start with [Getting started](getting-started.md). Use the [verification checklist](verification.md) to record which providers actually passed.

The repository can create its Cloudflare infrastructure, generate application secrets, migrate D1, deploy both apps, create Stripe test products/prices/webhooks, and clean up its resources through commands. An agent can run these commands without asking you to create tables or configure application logic in a dashboard.

Provider access comes first. Cloudflare needs an existing account and authorized API token. Google needs an OAuth web client with the exact callback registered. Stripe needs test secret and publishable keys from the same sandbox. The commands do not create provider accounts, accept terms, complete identity checks, or impersonate your Google account.

## Validate the implementation

Use the existing `pnpm` commands below. All tooling lives in `scripts/*.ts` and runs with `tsx`; `pnpm typecheck:tools` checks Node scripts, browser tests, configuration and the isolated Cloudflare test/cleanup Workers. Provider responses and resource manifests are validated before use. Test transports are in `scripts/fixtures/`, and Worker fixtures are in `scripts/workers/`; production configs do not import them.

```bash
pnpm install
pnpm validate
```

This runs setup contract tests, API integration tests, lint, formatting, types, production builds, and both production/development browser suites. It installs Chromium if missing. No Google or Stripe account is required: signed test sessions are seeded in isolated D1 storage and the real Stripe SDK/signature verifier talks to a local HTTP fixture. No login bypass is added to the application. Local test storage is deleted afterward. On a minimal Linux host, install Chromium's system dependencies first with `pnpm exec playwright install --with-deps chromium`.

For real Cloudflare infrastructure, supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, then:

```bash
pnpm validate --cloud
```

This additionally runs the existing deployed API/browser suite and the new sandbox provisioning lifecycle test. The lifecycle test provisions a sandbox, uploads an arbitrary nested R2 object, reruns setup, verifies stable resource IDs and secrets, then tears everything down. Each test environment is disposable. Cloud usage charges can apply while it exists.

A passing result does **not** claim that Google's real consent/code exchange or a real Stripe sandbox card payment was completed. PostHog ingestion/playable replay and email inbox delivery also need the live checks in the [verification guide](verification.md).

## Check account readiness

The scripts read `apps/api/.dev.vars`, then environment variables (which take precedence). To use a separate ignored secret file, set `STARTER_ENV_FILE=/absolute/path/setup.env`. For example, that file can contain:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
GOOGLE_CLIENT_ID=your-web-client.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

The Cloudflare token needs D1, Workers R2 Storage, Workers Scripts, and Pages edit access on the selected account. The account also needs its `workers.dev` subdomain enabled. Keep secret files outside Git; use an ignored file or inject values through your secret manager.

```bash
pnpm setup:doctor                   # presence and format checks; no network
pnpm setup:doctor --online          # also probes Cloudflare and Stripe APIs
pnpm --silent setup:doctor --json   # structured output for an agent
pnpm setup:doctor --strict          # nonzero exit when a prerequisite is missing
```

`configured` means credentials are present, not that sign-in or payment works. The online probe verifies only the API operations it reports; provisioning checks the remaining permissions. It never prints credential values.

## Create a sandbox you can click through

```bash
pnpm cloud:up my-demo
pnpm cloud:check my-demo
```

`cloud:up` provisions an isolated Worker, D1 database, R2 bucket, and two Pages projects, with a random suffix to avoid collisions. It generates fresh auth/proxy secrets for this environment, applies migrations, installs runtime bindings, builds and deploys the apps, and prints their HTTPS URLs and Google's exact callback URL. The template's tracked Wrangler config remains unchanged. Marketing is noindexed.

When Stripe test keys are present, setup also creates a £12 / 1,000-credit product and price, registers the Worker webhook, captures its signing secret, and deploys the bindings. If you supply an existing `STRIPE_PRICE_ID`, setup reuses that price and owns only the new webhook. A local listener's webhook secret is never copied to the cloud. No Stripe account resources are created when test keys are absent; the rest of the sandbox can still deploy.

Run `cloud:up my-demo` again after code or Google credential changes. It reuses resource IDs and signing secrets, and applies new migrations. Changing Stripe credentials while owned Stripe resources exist is rejected so that resources cannot become stranded in another account; clean up with the original credentials first.

State and secrets are stored under the ignored `.wrangler/sandboxes/my-demo/` directory. Preserve that directory while the environment exists. Secrets use owner-only file permissions. The manifest identifies the resources owned by this setup. A name without a manifest cannot be used to take over an unrelated deployment.

`cloud:check` verifies live health endpoints, the app-to-Worker proxy, anonymous API rejection, dashboard login protection, HTTP 404 behavior, and sandbox noindex. It reports Google/Stripe configuration separately from provider verification. It never seeds demo accounts, writes user data, or spends credits in a retained sandbox.

### Finish provider access once per environment

| Provider   | Agent can do                                                                                         | Owner/account prerequisite                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cloudflare | Provision resources, secrets, migrations, deploy, validate, delete                                   | Account, billing if required, authorized token, workers.dev subdomain                  |
| Google     | Reuse the client, configure the app, navigate the console after owner sign-in, test the callback     | Google account access; exact web-client callback allowlist and any test-user settings  |
| Stripe     | Create test product/price/webhook, capture signing secret, verify orders and grants                  | Same-sandbox test keys or owner-authorized account access to obtain them               |
| PostHog    | Create/configure a dedicated project, dashboards and insights; deploy public settings; query reports | Authenticated connection or scoped personal key; selected organization and region      |
| Email      | Configure an authorized sender domain and restricted Worker binding                                  | Cloudflare Email Service access, verified sender domain and a permitted test recipient |

Google's documented setup for a standard web OAuth client uses the [Google Auth Platform console](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred). The `gcloud iam oauth-clients` / `projects.locations.oauthClients` interface is [for Workforce Identity Federation](https://docs.cloud.google.com/iam/docs/workforce-oauth-app), not this starter's Google sign-in. A new dashboard hostname therefore still needs its exact callback registered. An agent can perform the configuration through an authenticated browser; it cannot bypass sign-in, MFA, or consent.

[Stripe CLI sign-in](https://support.stripe.com/questions/sign-in-to-stripe-cli) can establish authorized access, but it also begins with owner authentication or an existing key. The product, price, and webhook setup afterward is automated here. This starter only accepts test-mode payments.

After those prerequisites are satisfied, open the printed dashboard URL and validate:

1. Sign in with Google; confirm the user is created and remains signed in after reload.
2. Create/complete/delete a todo; upload/download/delete a file.
3. Add credits with a Stripe test card; reload the success page and confirm credits are granted once.
4. Create a Summary API key, run the supplied curl command, and repeat it with the same idempotency key. Only the first request spends a credit.
5. Delete the key and confirm it returns 401; sign out and confirm the dashboard is protected.
6. Submit the marketing waitlist and check its success page. Visit an unknown URL and `/error` to inspect the recovery UI.

Use a decline and a 3DS test card too; details are in the [payment guide](payments.md). For repeated new projects without per-project Google console changes, a shared authentication service with a fixed Google callback is a possible future architecture. This repo currently uses direct Google authentication per environment.

## Tear down

```bash
pnpm cloud:down my-demo
```

This explicitly deletes the sandbox's data and resources. It removes both Pages projects, archives owned Stripe products/prices, removes the owned webhook, empties the R2 bucket including arbitrary nested uploads, and deletes R2, D1, and the Worker. Existing Stripe prices are retained. Stripe retains payment/session history; use a dedicated sandbox for card testing.

R2 emptying briefly replaces the sandbox's own Worker with a secret-protected, bucket-only cleanup worker, then deletes it. Teardown independently checks resource absence before removing the local manifest and secrets. It never targets the normal template resource names.

If setup or teardown fails, retain the manifest and retry the same command or `cloud:down`. If a process was forcibly killed, ensure it is no longer running before removing the `.lock` file in that sandbox directory. Do not delete the whole directory until cleanup completes. Existing resources may continue to incur charges until cleanup succeeds.

For a disposable test of this lifecycle alone:

```bash
pnpm test:cloud-setup
```

## Drizzle and email

Schema changes live in `packages/data/src/schema.ts`; run `pnpm db:generate --name my_change` and review the migration before deployment. `pnpm validate` includes schema drift, upgrade preservation and email tests.

For email, choose the sender domain/address, authorize its Cloudflare zone, and set `EMAIL_FROM` plus `CLOUDFLARE_ZONE_ID`. `pnpm email:setup` uses the domain API; `pnpm email:check` checks that configuration. `cloud:up` enables the sender-restricted binding. Without a sender, the dashboard shows that email is disconnected and waitlist signups still save. [The data/email guide](data-and-email.md) explains permissions, DNS, local simulation, delivery status and cleanup. Real inbox delivery requires a chosen recipient and a separate live test.

## Publish on your domain

After `pnpm cloud:up my-demo`, run:

```bash
pnpm cloud:domain my-demo devtemplate.example.com
```

The token also needs zone read and DNS edit access. This attaches the marketing Pages project to a subdomain in the same Cloudflare account, creates its CNAME, saves domain ownership in the ignored manifest, and redeploys with the correct canonical URL and indexing enabled. It refuses to replace DNS for another service. Subsequent `cloud:up` runs retain the public URL; `cloud:check` verifies it. The dashboard URL and Google callback stay the same. `cloud:down` removes DNS created by this command along with the project's resources, but retains a matching DNS record that already existed.

The maintained demo is `showcase` at https://devtemplate.leitware.com. Keep its ignored manifest and secrets to update the same resources without rotating credentials.

## PostHog

Use the connected PostHog app or `pnpm posthog:setup` with an explicitly selected organization/project and management credential. The helper creates a project if needed, enables masked replay support, prepares reporting, and saves public collection settings locally. `pnpm setup:local` and `pnpm cloud:up NAME` wire both apps and the Worker; `pnpm posthog:report` checks seven-day results. An agent can do this without account GUIs once authenticated. See [observability](observability.md) for scopes, consent, event contracts and verification. Do not claim live ingestion or replay from fixture tests or key presence alone.
