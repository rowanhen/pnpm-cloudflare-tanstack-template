# Environment configuration

This project deliberately keeps the root `.env.local` encrypted with dotenvx. It is the backup/source of truth for persistent provider credentials and deployment settings; GitHub Actions and Cloudflare hold deployment copies. Only ciphertext and `DOTENV_PUBLIC_KEY_LOCAL` are committed. The decryption key in `.env.keys` stays private and ignored. A fresh clone without that key can run the local database and public examples without decrypting anyone else's settings.

`pnpm lint:env` checks the tracked-file list and both staged and working copies of encrypted settings without decrypting or printing values. It rejects plaintext assignments, duplicate names, private keys and accidentally tracked local runtime files. It runs in `pnpm lint`, CI and pre-commit. This validates storage format, not provider access or ciphertext authenticity. New projects must create their own credentials and encryption key; do not reuse this repository's encrypted credentials.

## Local precedence

`scripts/setup-env.ts` merges settings in this order, with later sources winning:

1. Ignored `apps/api/.dev.vars`, or the file selected by `STARTER_ENV_FILE`.
2. Root `.env.local`, decrypted only when `.env.keys` or `DOTENV_PRIVATE_KEY_LOCAL` is available. A bad key fails instead of silently falling back.
3. The command's process environment, including explicitly empty values.

`pnpm setup:local` creates `.dev.vars` from its tracked `.example` only if absent, with a random local auth secret. It copies only its listed Google and Stripe settings from the merged configuration. `DEV_BETTER_AUTH_SECRET` maps to local `BETTER_AUTH_SECRET`; production auth secrets are never copied there. `STRIPE_LOCAL_WEBHOOK_SECRET` maps to the local webhook secret, keeping it separate from the deployed endpoint's signing secret. Existing nonempty provider settings are preserved when an overlay is absent/empty; clear the local file explicitly to disable a previously configured provider.

Public PostHog collection settings are validated separately and written into both ignored frontend `.env.local` files. Unrelated frontend settings are preserved. The setup script does not copy private configuration into Vite files.

## Build and deployment

[Vite's environment precedence](https://vite.dev/guide/env-and-mode#env-files) puts the process environment above app `.env` files, and mode-specific files above generic files. Only `VITE_` names are available in browser code: use them for public origins, display names and validated public analytics tokens, never private credentials. Frontend example files contain public defaults. The repository-root encrypted file is not a frontend environment file.

Wrangler reads the API's local `.dev.vars` during development, and configured Worker/Pages secrets and bindings in deployment. Its tracked configuration supplies non-secret defaults. GitHub Actions explicitly supplies build-time `VITE_` settings; deploying those builds does not reread the root encrypted file or change bundled values. After changing a public build setting, rebuild. After changing a persistent credential, update the encrypted source first, then its deployment copies using the [deployment guide](manual-deployment.md).
