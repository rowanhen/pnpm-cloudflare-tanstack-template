# Set up and validate with an agent

Read the [one-page structure guide](architecture.md) and [getting started](getting-started.md) first. Use the pinned Node/pnpm versions and existing package commands.

## Local workflow

```bash
pnpm install
pnpm api:generate # after contract changes
pnpm validate
```

`validate` is an alias for `pnpm check`: lint, formatting, migration drift/upgrade checks, unit/API integration tests, TypeScript and builds. Tests run locally; CI runs generation/drift checks, lint, formatting, schema checks, TypeScript and builds. Review frontend flows manually in a browser.

Tests use isolated local D1/R2 storage and provider fixtures. The test Worker and transports live under `tests/support/`, outside production code. Tests do not complete Google consent or real card payments, send live analytics or deliver real email. Record live evidence separately using [verification](verification.md).

## Provider setup and deployment

Use [Wrangler deployment](manual-deployment.md) for native resource, binding, secret and upload commands. Optional providers use their own dashboards, CLIs or authenticated connectors; this template has no custom cloud sandbox manager, account provisioner or teardown script.

- Cloudflare: an existing account, authorized access, Workers/D1/R2/Pages permissions and a workers.dev subdomain.
- Google: a Web application OAuth client with the exact dashboard callback; [Google sign-in](google-sign-in.md).
- Stripe: same-sandbox test keys, an active one-time price and webhook; [payments](payments.md).
- PostHog: selected project, public collection token and regional host; [observability](observability.md).
- Email: verified sender domain, restricted Worker binding and an inbox you control; [data and email](data-and-email.md).

The owner may need to complete login, MFA, consent, billing or domain verification. Keep secrets out of `VITE_` settings, commits and logs. Supply Wrangler credentials through its login or environment; it does not use the template's local `.dev.vars` loader for account authentication. App credentials use Worker/Pages secrets in deployment.

Local tests create no remote resources. Review resource names before manual deletion; the maintained `showcase` deployment at https://devtemplate.leitware.com should remain. Earlier deployments may retain configuration and secrets under ignored `.wrangler/sandboxes/<name>/`. Preserve those files and use their existing Wrangler config explicitly when maintaining them; this cleanup does not migrate or delete deployments.

For schema changes, edit `packages/data/src/schema.ts`, generate and review SQL, then migrate. For API changes, edit OpenAPI, reference new paths in `api.json`, regenerate, implement typed handlers and run the checks. Never edit generated files.
