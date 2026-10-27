# Connect the providers

Use the [deployment guide](manual-deployment.md) for Cloudflare resources, production bindings, secrets and deployment. The template uses Wrangler directly; the previous `cloud:up`, `stripe:setup` and `setup:doctor` helpers have been retired.

## Local setup

Run `pnpm install`, then `pnpm setup:local`. Setup creates a local API environment file from its example with a fresh development auth secret, and synchronizes configured provider values. Run `pnpm dev` to apply local database migrations and start the apps. Local D1 and R2 do not require a Cloudflare account.

Keep persistent credentials in the dotenvx-encrypted root `.env.local` before copying them to GitHub Actions or Cloudflare. Keep `.env.keys` private. Development and production auth secrets must remain separate. Never put private credentials in `VITE_` variables.

## Provider configuration

- **Google:** follow [Google sign-in](google-sign-in.md). Leitware projects can reuse their shared web OAuth client with each exact dashboard callback registered, while keeping per-project auth secrets and sessions.
- **Stripe:** follow [Payments](payments.md). Use test keys and the configured test offers; forward local webhook events using the Stripe CLI and save the listener's signing secret in local configuration. Verify checkout and webhook delivery rather than treating credential presence as proof of readiness.
- **Email:** follow [Data and email](data-and-email.md). Configure a verified sending identity and verify actual delivery.
- **PostHog:** follow [Observability](observability.md). Only the public collection token belongs in frontend build settings; keep management credentials private.

## Verify and deploy

Run `pnpm check` for local validation. Follow the [verification guide](verification.md) for remaining live-provider checks. A successful build does not prove Google callback registration, card payment or email delivery.

For deployment, load the production environment, verify the configured resource names and bindings, then use the commands in [Cloudflare deployment](manual-deployment.md). Cloned projects need their own resource and GitHub Actions settings; they do not inherit the maintained showcase deployment.
