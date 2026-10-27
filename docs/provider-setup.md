# Connect the template once, then reuse the workflow

Start locally with Google, Stripe test payments and PostHog, then deploy the same application. The integration code is already present. Each new project needs its own provider configuration and the final browser checks below.

## What is ready, and what you supply

| Service               | Template handles                                          | Account owner supplies                                                                 |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Local data            | D1 migrations, R2 simulation, auth secret                 | Nothing                                                                                |
| Google sign-in        | OAuth, private sessions, protected dashboard              | Web OAuth client, exact callbacks, permitted test users                                |
| Stripe sandbox        | Product, £12 price, webhook, 1,000-credit grants          | Secret and publishable test keys from one sandbox                                      |
| PostHog               | Consent, events, masked replay, errors, reporting scripts | Selected project/region and public token; management access for automated provisioning |
| Cloudflare deployment | Worker, D1, R2, two Pages apps, runtime secrets           | Account ID, API token and account access to those products                             |
| Email (optional)      | Templates, deduplication, restricted sending              | Authorized sender domain and an inbox you control for testing                          |

Put credentials in the ignored `apps/api/.dev.vars`, not chat or committed source. The public PostHog collection token is the only provider credential copied into frontend build variables. Keep the generated `BETTER_AUTH_SECRET`. Never copy a project's secrets, database, `.env.local` files or `.wrangler` manifests into a new project.

## 1. Prepare local development

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm setup:local
pnpm setup:doctor
pnpm validate
```

`setup:local` generates the ignored credential file without overwriting it, and synchronizes public analytics settings into both frontends. `validate` tests the application with isolated provider fixtures; it does not complete account login or real sandbox payments. Leave ports 3000, 3001 and 8787 free while it runs. Start `pnpm dev` afterward.

## 2. Connect Google account sign-in

In [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the intended Google Cloud project. Configure Branding and Audience, then create a **Web application** under Clients. If the audience is in Testing, add your own Google account under Test users.

For the Leitware setup, reuse one web OAuth client's ID and secret in the existing `leitware-auth` project, and add each deployed dashboard's exact callback to that client's allowlist. Keep each project's `BETTER_AUTH_SECRET` separate. See [reuse the Leitware client](google-sign-in.md#reuse-the-leitware-google-client-across-products). The existing auth implementation supports this directly.

Register these exact local values:

| Field                        | Value                                            |
| ---------------------------- | ------------------------------------------------ |
| Authorized JavaScript origin | `http://localhost:3001`                          |
| Authorized redirect URI      | `http://localhost:3001/api/auth/callback/google` |

Copy the client ID and secret into the existing fields in `apps/api/.dev.vars`:

```dotenv
GOOGLE_CLIENT_ID=YOUR_CLIENT.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

Restart `pnpm dev`. Open `http://localhost:3001`, complete **Continue with Google**, create a todo and reload. Sign out and confirm the dashboard requires sign-in again. This is Google account sign-in, including Gmail accounts; reading a Gmail inbox is a separate integration.

Google's callback is on the **dashboard**, because that app proxies `/api` to the Worker. Do not register the marketing domain or Worker origin as this callback. Google requires the redirect URI to match the configured client exactly. See [Google's OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) and [template troubleshooting](google-sign-in.md).

## 3. Connect Stripe test payments

Open your selected [Stripe sandbox](https://dashboard.stripe.com/sandboxes). Copy its secret and publishable keys into the existing fields:

```dotenv
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLIC_KEY
```

Both keys must belong to that same sandbox. The template accepts test keys only. See [Stripe's key guide](https://docs.stripe.com/keys).

Run once to create the test product and price:

```bash
pnpm stripe:setup
```

The helper saves `STRIPE_PRICE_ID` and an ignored resource manifest. If a price is already configured, keep it; do not rerun setup just to test another payment.

In another terminal, authenticate the installed Stripe CLI and keep its listener running:

```bash
stripe login
stripe listen --forward-to localhost:8787/api/stripe/webhook
```

Check that the CLI uses the same sandbox as the app keys. Put the listener's `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in `.dev.vars`, then restart `pnpm dev`. Keep the listener running during payments; update the secret if the listener reports a different one. [Stripe CLI guide](https://docs.stripe.com/cli).

Run `pnpm setup:doctor --online`. It checks secret-key API access and, when configured, the price's availability and test/one-time status. It does not prove the publishable key matches or that a webhook was delivered.

Sign in at the dashboard, open **Add credits**, and complete a test payment:

| Scenario       | Card number           | Expected result                             |
| -------------- | --------------------- | ------------------------------------------- |
| Success        | `4242 4242 4242 4242` | Verified payment adds exactly 1,000 credits |
| Decline        | `4000 0000 0000 0002` | Error, no credits added                     |
| Authentication | `4000 0025 0000 3155` | 3DS challenge, credits after completion     |

Use a future expiry and any three-digit CVC. These are [Stripe test cards](https://docs.stripe.com/testing), so no money moves. Reload the success page and confirm credits do not increase again. Confirm a 2xx webhook response in the CLI; status polling can confirm a payment too, so the success page alone does not prove webhook delivery. Test the paid API and retry behavior using [the metering example](pay-per-request.md#try-it).

## 4. Connect PostHog

Select a dedicated PostHog project and confirm its region. If using the connected PostHog app, reconnect it when authentication has expired, then tell the agent the organization/project to target. The agent can configure that selected project and reporting through the connection.

For manual configuration, copy the project's public collection token into `.dev.vars`:

```dotenv
POSTHOG_KEY=phc_YOUR_PROJECT_TOKEN
POSTHOG_HOST=https://eu.i.posthog.com
```

Use `https://us.i.posthog.com` for a US project. Enable replay in the selected project. Leave `APP_ENV` unset to use the template's defaults: `development` locally and `production` for cloud provisioning.

Run `pnpm setup:local` and restart `pnpm dev`. The setup copies the public values into both apps. On the marketing site, allow analytics, navigate and submit the waitlist with your own address. Check live events in the selected project and open an actual replay. Allow analytics separately on the dashboard origin. Check declining/withdrawing consent stops browser capture.

For automated project/dashboard provisioning, use the management credential flow in [the observability guide](observability.md). A `phx_` personal API key is a management credential; it is never a frontend collection token. The full [verification checklist](verification.md#posthog-events-errors-and-replay) covers errors, replay playback and API request correlation.

## 5. Deploy when the local checks pass

Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` through your shell's secret manager or the ignored `.dev.vars`. The token needs account-scoped Workers Scripts, D1, Workers R2 Storage and Pages edit access. The account needs its `workers.dev` subdomain and product access enabled.

```bash
pnpm setup:doctor --online
pnpm cloud:up my-demo
pnpm cloud:check my-demo
```

The command prints the dashboard URL and exact Google callback. Add both to the same Google web client, or configure a separate production client and update the keys. Complete a new sign-in at that deployed dashboard.

With Stripe test keys, cloud setup creates a webhook pointing at the Worker and installs its own signing secret. Keep the local listener secret locally. It can reuse your configured price. Repeat the card, webhook, credit and PostHog checks on the deployment; local success does not prove those deployed URLs work.

Keep `.wrangler/sandboxes/my-demo/` to update the same deployment. This checkout may not contain another checkout's ignored manifests. Do not attempt to update the maintained `showcase` without its original state; `cloud:up` cannot adopt an existing deployment by name. See [agent setup](agent-setup.md).

Live email comes afterward: choose the sender domain, follow [data and email](data-and-email.md), and check your own inbox. Local email sending is simulated.

## 6. Repeat for the next project

Clone the tracked template into a fresh directory, then:

```bash
pnpm install --frozen-lockfile
pnpm setup-project my-new-project
pnpm setup:local
# Add this project's provider configuration to apps/api/.dev.vars.
pnpm setup:doctor --online
pnpm validate
pnpm dev
# After the local provider checks:
pnpm cloud:up my-new-project
pnpm cloud:check my-new-project
```

Keep the cloud environment name lowercase, starting with a letter, and at most 25 characters. Customize the marketing copy and public URLs too; `setup-project` updates the project/package/resource names, not every page's branding.

You can reuse provider accounts. Give each application its own Stripe catalog or sandbox, PostHog project and Cloudflare environment. Reuse the Leitware Google client keys and register each dashboard callback in that shared client, while keeping each project's auth secret and D1 sessions separate. See [the Google guide](google-sign-in.md#reuse-the-leitware-google-client-across-products). Local `pnpm stripe:setup` and the CLI listener are needed again if you want local card testing in the new project. The application code can be copied; this account configuration remains per project.

Record evidence before declaring a project ready:

- [ ] `pnpm validate` passed in this checkout.
- [ ] Real Google sign-in, reload and sign-out passed locally and on the deployment.
- [ ] Success, decline and 3DS test payments passed; the webhook returned 2xx.
- [ ] Credits were granted once, spent once and preserved on an idempotent retry.
- [ ] PostHog live events appeared in the intended project/environment; replay played; consent controls worked.
- [ ] D1 todos, R2 upload/download/delete and API-key revocation passed.
- [ ] If email is enabled, a test reached the intended inbox.

Use [verification.md](verification.md) for the detailed acceptance steps. Keep an evidence record with the date and environment, without credentials or personal data.
