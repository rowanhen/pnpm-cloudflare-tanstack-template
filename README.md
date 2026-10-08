# pnpm-cloudflare-tanstack-template

A TypeScript starter with a waitlist website, Google sign-in, a private dashboard and a REST API on Cloudflare. Uses TanStack Start, Drizzle, D1, R2 and Composables with the Kumo preset.

[Live example](https://devtemplate.leitware.com) · [Beginner setup](docs/getting-started.md) · [Integration verification](docs/verification.md)

## Run locally

Install [Node.js 24 LTS](https://nodejs.org/en/download) and [Git](https://git-scm.com/downloads), then run:

```bash
git clone https://github.com/rowanhen/pnpm-cloudflare-tanstack-template.git my-project
cd my-project
corepack enable
pnpm install
pnpm dev
```

If `corepack` is missing, run `npm install --global corepack` first. Node 22.12+ is supported; the repository selects pnpm 10.34.6. Run commands from the repository root. Leave `pnpm dev` running and open:

| App       | Local address                    | What works first                                    |
| --------- | -------------------------------- | --------------------------------------------------- |
| Marketing | http://localhost:3000            | Waitlist, privacy, success/error pages and SEO      |
| Dashboard | http://localhost:3001            | Sign-in page; Google setup unlocks private examples |
| API       | http://localhost:8787/api/health | Worker REST API and local D1/R2 storage             |

Local D1 and R2 need no Cloudflare account. `pnpm dev` creates local secrets and applies migrations. No provider keys are bundled. Google, Stripe, PostHog and email each need their own setup; an unavailable provider does not stop the waitlist from saving.

## Examples

- Google login, D1 users/sessions and a protected dashboard.
- Private todos, file uploads/downloads, scoped API keys and rate limits.
- Stripe **test** checkout → prepaid credits → one-credit API requests, with safe retries.
- Optional Cloudflare email and consent-based PostHog analytics, masked replay and error reporting.
- Waitlist success, verified checkout status, custom 404/error pages and marketing SEO.

Start with the [step-by-step guide](docs/getting-started.md). The [verification guide](docs/verification.md) separates tested application behavior from live provider checks and records the maintained demo's remaining setup.

## Test and deploy

```bash
pnpm validate             # local API, types, builds and browser tests; no provider accounts
pnpm setup:doctor --online # check available credentials; not proof of login or payment
pnpm cloud:up my-demo      # requires Cloudflare credentials; prints deployed URLs
pnpm cloud:check my-demo   # read-only deployment checks
```

`pnpm validate --cloud` also creates real, disposable Cloudflare resources, tests them and verifies cleanup. It does not complete Google consent, Stripe card entry, PostHog account ingestion or email inbox delivery. See [verification and cleanup](docs/verification.md).

To remove an environment you no longer need, run `pnpm cloud:down my-demo`. This deletes its database and files. Keep the ignored `.wrangler/sandboxes/my-demo/` directory until cleanup finishes.

## Guides

| Task                                              | Guide                                       |
| ------------------------------------------------- | ------------------------------------------- |
| First project, pages and deployment               | [Getting started](docs/getting-started.md)  |
| Google client, callback URLs and sign-in problems | [Google sign-in](docs/google-sign-in.md)    |
| Test cards, custom checkout and webhooks          | [Payments](docs/payments.md)                |
| Charge credits for a private REST endpoint        | [Pay per request](docs/pay-per-request.md)  |
| D1 types, migrations and Cloudflare email         | [Data and email](docs/data-and-email.md)    |
| Analytics, session replay and API errors          | [PostHog](docs/observability.md)            |
| Automated setup, permissions and teardown         | [Agent setup](docs/agent-setup.md)          |
| Component conventions, folders and REST routes    | [Code and API reference](docs/reference.md) |

Application code, configuration, scripts and tests are TypeScript. D1 schema types live in `@workspace/data`; validated public API types and the client live in `@workspace/contracts`. Both apps share the UI and observability packages. GitHub's required **Verify** check gates dependency auto-merges.
