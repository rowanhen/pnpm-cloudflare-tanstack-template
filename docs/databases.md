# Application database

Each project starts with one D1 database and one Worker binding, `DB`. All 15 tables share that database. Schema files remain grouped by feature for readability:

| Schema   | Tables                                                                            |
| -------- | --------------------------------------------------------------------------------- |
| Identity | users, sessions, accounts, verifications, auth_rate_limits, api_keys, rate_limits |
| Billing  | orders, stripe_events, credit_accounts, credit_grants, paid_requests              |
| Product  | todos, waitlist, email_deliveries                                                 |

Use `database(env.DB)` from `@workspace/data/client`. Import tables from the feature exports or `@workspace/data/schema`. Schema organization does not provision separate resources.

## New projects and schema changes

`pnpm setup-project my-project` names the database `my-project-db`. Provision one database, set its ID on `DB`, and use `migrations` as its migration directory. `pnpm dev` applies that single migration history locally.

```bash
pnpm db:generate --name add_my_feature
pnpm db:migrate
pnpm db:check
```

Commit SQL and `apps/api/migrations/meta/` together. CI applies the same migration history before deployment. Do not use `drizzle-kit push` on an existing deployment.

## References and consistency

Keep owner filters on every private query. Billing fulfilment, credits and request receipts retain their atomic batches. A summary reads product data before saving its response and debit in a batch; sharing a database does not automatically make that earlier read transactional. Account deletion is not enabled. Existing user/key ID references and retention behavior are preserved; consolidation does not introduce new cascading deletes.

## Existing deployments

The application baseline is for a fresh database. Never apply it directly over an existing populated database. Original migrations remain in `apps/api/legacy-migrations/`; the previous three histories are archived in `apps/api/split-migrations/` for migration fixtures and reference.

1. Preserve the existing Worker configuration as `source.json`. It can contain the three old bindings (`IDENTITY_DB`, `BILLING_DB`, `PRODUCT_DB`) or the original `DB` binding. Create one fresh target database and a `target.json` configuration with only `DB`, its new ID, and an absolute path to `apps/api/migrations`. Preserve all other Worker settings and secrets. The showcase's original `starter-showcase-18d8b58f-db` is historical: do not reuse it as an empty destination.
2. Put the currently deployed API into `DATABASE_MAINTENANCE="true"` using its existing code and bindings. Verify `/api/health` reports `maintenance: true`. Pause any other writers and wait for in-flight requests to finish. Stripe retries webhooks.
3. Copy and verify every value:

   ```bash
   pnpm db:merge --remote --source-config source.json --target-config target.json \
     --backup-dir .wrangler/database-backup-unique-name \
     --maintenance-url https://your-api.example/api/health
   ```

   For local data, stop the API and use `--local` without the maintenance URL; pass `--persist-to apps/api/.wrangler/state` for existing local storage. The tool accepts the original single database too. It refuses populated targets and unexpected source tables, exports private backups with restricted permissions, and verifies every copied record and foreign key. Sources remain unchanged. A failed copy requires inspection and a fresh target before retrying. Never commit backup data.

4. Update the showcase config and CI `CLOUDFLARE_WORKER_CONFIG` to the verified single `DB` target, with `migrations_dir: "migrations"` in the CI config. Deploy this version while still in maintenance. Then disable maintenance and verify an existing session, owned records, credit balances and checkout.
5. Retain the sources for rollback review. After writes resume, switching back would lose new updates. Delete old databases only after the live cutover is accepted.

In `cf-infra`, `cloudflare_d1_database.template` defines the fresh showcase destination and `template_database` exposes the ID/name/binding. Apply that resource before preparing the target configuration. Schema migrations remain in this repository.
