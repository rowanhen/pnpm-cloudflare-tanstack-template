# Cloudflare deployment with Wrangler

Wrangler owns resource creation, binding configuration, secrets and deployment. Package scripts are short aliases for native commands. Optional Google, Stripe, PostHog and email account setup is documented separately.

Authenticate with `pnpm exec wrangler login`, or export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. API provisioning needs D1, Workers R2 Storage, and Workers Scripts Edit permissions; app deployment also needs Cloudflare Pages Edit.

1. Choose names (`pnpm setup-project my-project`), then provision:

   ```bash
   pnpm exec wrangler d1 create my-project-db --config apps/api/wrangler.json
   pnpm exec wrangler r2 bucket create my-project-files
   pnpm exec wrangler pages project create my-project-marketing --production-branch main
   pnpm exec wrangler pages project create my-project-dashboard --production-branch main
   ```

2. In `apps/api/wrangler.json`, set the returned D1 `database_id` and matching resource names. The all-zero UUID is a placeholder for local development. Each website's `wrangler.json` sets its Pages project name and `dist` output; `setup-project` updates those names too. Set `AUTH_URL` to `https://my-project-dashboard.pages.dev` (or your custom dashboard domain), and `ALLOWED_ORIGINS` to the exact marketing/dashboard origins, comma separated, without trailing slashes.
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

`pnpm deploy` migrates/deploys the API and uploads both app builds to Pages. Builds use exported environment variables or the apps' normal Vite environment files; the removed deployment wrapper no longer loads `apps/api/.dev.vars` for frontend builds. Review the URLs and origins above before deploying. `pnpm deploy:marketing` and `pnpm deploy:dashboard` deploy individual apps. The build output is `dist/`. Terraform can own Pages projects, domains, and DNS while these commands upload builds. Avoid wildcard trusted origins; each deployment should have its own OAuth callback and auth secret.

After deployment, complete a real Google sign-in, confirm your profile/todo/file persist, create and revoke a key, and sign out. Automated tests do not authenticate with Google's live consent screen.

For schema changes, edit `packages/data/src/schema.ts`, run `pnpm db:generate --name my_change`, and review the generated SQL in `apps/api/migrations/`. The auth schema matches the installed Better Auth version; review its migration output when upgrading. Migration 0003 preserves old anonymous demo todos with no owner, making them inaccessible to signed-in users. Old unprefixed R2 objects are also inaccessible; deliberately migrate or delete that legacy demo data. D1 rate-limit rows are reused per identifier; periodically remove stale counters and expired auth records for a long-lived deployment.

## Custom domains and existing deployments

Attach custom domains and configure DNS through Cloudflare Pages settings. Rebuild marketing with the final `VITE_SITE_URL` and `VITE_NOINDEX=false`; keep previews noindexed. A dashboard hostname change also requires updating `AUTH_URL`, allowed origins and Google's callback.

Previous helper-managed deployments retain ignored `.wrangler/sandboxes/<name>/` configuration, manifests and secrets. Preserve those files. Use the existing configuration explicitly, for example `pnpm exec wrangler deploy --config .wrangler/sandboxes/NAME/wrangler.json`, and use the matching Pages project names for uploads. The normal template config does not discover or take ownership of them. No existing resources are changed by removing the helpers.

Delete obsolete resources through Wrangler or provider dashboards after checking their names and data. There is no automatic remote teardown. Keep the maintained `showcase` deployment and its retained configuration.
