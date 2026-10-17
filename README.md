# pnpm-cloudflare-tanstack-template

A TypeScript starter with a waitlist website, Google sign-in, a private dashboard and a REST API on Cloudflare. Uses TanStack Start, Drizzle, D1, R2 and Composables with the Kumo preset.

[Live example](https://devtemplate.leitware.com) · [Beginner setup](docs/getting-started.md) · [Integration verification](docs/verification.md)

## Run locally

Install [Node.js 26.12.0](https://nodejs.org/en/download) and [Git](https://git-scm.com/downloads), then run:

```bash
git clone https://github.com/rowanhen/pnpm-cloudflare-tanstack-template.git my-project
cd my-project
nvm install
nvm use
npm install --global pnpm@10.34.7
pnpm install
pnpm dev
```

The repository pins Node 26.12.0 in `.nvmrc` and pnpm 10.34.7 in `package.json`. `pnpm install` also installs the pinned Node runtime for project scripts. The `nvm` commands use [Node Version Manager](https://github.com/nvm-sh/nvm); if you install Node directly, use the pinned version and skip those two commands. Run commands from the repository root. Leave `pnpm dev` running and open:

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
pnpm api:generate # after changing OpenAPI contracts
pnpm check        # lint, formatting, migrations, unit/API tests, types and builds
pnpm validate     # alias for pnpm check
```

Deploy with the [Wrangler deployment guide](docs/manual-deployment.md). Cloudflare resources, secrets and provider accounts use their native tools; this template does not maintain its own provisioning or teardown framework. Live provider checks are described in [verification](docs/verification.md).

## Guides

| Task                                              | Guide                                               |
| ------------------------------------------------- | --------------------------------------------------- |
| Project structure and adding typed API features   | [One-page architecture guide](docs/architecture.md) |
| First project, pages and deployment               | [Getting started](docs/getting-started.md)          |
| Google client, callback URLs and sign-in problems | [Google sign-in](docs/google-sign-in.md)            |
| Test cards, custom checkout and webhooks          | [Payments](docs/payments.md)                        |
| Charge credits for a private REST endpoint        | [Pay per request](docs/pay-per-request.md)          |
| D1 types, migrations and Cloudflare email         | [Data and email](docs/data-and-email.md)            |
| Analytics, session replay and API errors          | [PostHog](docs/observability.md)                    |
| Agent workflow and provider access                | [Agent setup](docs/agent-setup.md)                  |
| Component conventions, folders and REST routes    | [Code and API reference](docs/reference.md)         |

Start with the [one-page structure guide](docs/architecture.md). The [detailed API walkthrough](docs/api-architecture.md) explains the OpenAPI → Orval → Hono + Effect flow, demonstrated by todos. Add or edit feature contracts, run `pnpm api:generate`, and implement the typed entry points; routes, clients, hooks, and mocks are generated automatically.

Application code, scripts and tests are TypeScript; OpenAPI and Wrangler configuration use JSON. D1 schema types live in `@workspace/data`; validated public API types and the client live in `@workspace/contracts`. Both apps share the UI and observability packages. GitHub's required **Verify** check gates dependency auto-merges.
