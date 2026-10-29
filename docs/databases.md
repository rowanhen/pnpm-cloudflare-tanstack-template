# Database boundaries

The starter has three D1 databases. They are grouped by responsibility, rather than one database per table or endpoint.

| Domain   | Binding       | Tables                                                                                          |
| -------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Identity | `IDENTITY_DB` | `users`, `sessions`, `accounts`, `verifications`, `auth_rate_limits`, `api_keys`, `rate_limits` |
| Billing  | `BILLING_DB`  | `orders`, `stripe_events`, `credit_accounts`, `credit_grants`, `paid_requests`                  |
| Product  | `PRODUCT_DB`  | `todos`, `waitlist`, `email_deliveries`                                                         |

Schema files are `packages/data/src/identity.ts`, `billing.ts` and `product.ts`. Each has a matching migration directory under `apps/api/migrations/`. Use `identityDatabase`, `billingDatabase` or `productDatabase` from `@workspace/data/client` and import tables from the matching domain export. `@workspace/data/schema` is a legacy aggregate; use domain imports for runtime queries. Public API types come from OpenAPI, independently of database row types.

The identity database owns authentication and API-key validity. Rate-limit counters are security infrastructure and stay here too. Billing owns the full credit ledger: payment events, order fulfilment, balances and receipts must remain together so their D1 batches commit or roll back together. Product holds the starter's application examples; a real project can rename it or add a domain when there is a concrete ownership boundary. Avoid creating an empty database for every future feature.

## References and consistency

Cloudflare D1 batches are transactions within one database. There are no cross-database joins, foreign keys or atomic batches. Keep local foreign keys (sessions → users, grants → orders). References across domains, such as billing `user_id`, product `user_id` and receipt `key_id`, are stable IDs, not SQL foreign keys. Authenticate the caller in identity and retain the existing owner filters on every product/billing query. Never accept an arbitrary owner ID from a request.

The summary example reads a product snapshot, then atomically saves that JSON response with its receipt and credit debit in billing. Concurrent retries choose one receipt; all later retries return the saved response without another debit. The snapshot is not a transaction across databases and can precede a concurrent product edit. This approach is appropriate for a read-only report. A paid mutation spanning domains needs an explicit durable workflow/outbox with idempotent steps and compensation; do not split awaited writes and call them a transaction.

Account deletion is not enabled in this starter. Before enabling it, implement a durable, retryable deletion workflow covering product records, R2 files and the billing retention policy before removing identity records. Deleting an identity record does not cascade into other databases. Do not add placeholder users to billing/product to recreate cross-database foreign keys.

## New projects and schema changes

`pnpm dev` applies migrations to all three local bindings. `pnpm setup-project my-project` names the three resources consistently. Provision all three databases for deployment and put their IDs in Wrangler; the checked-in IDs are local placeholders.

```bash
pnpm db:generate --domain product --name add_my_feature
pnpm db:migrate
pnpm db:check
```

`--domain identity` and `--domain billing` select the other migration histories. Commit each domain's generated SQL and `meta/` together. `db:check` checks all journals and verifies that each schema matches its snapshot. Do not run `drizzle-kit push` on an existing deployment. CI's separate deployment job applies every domain's pending migrations before publishing the verified build.

## Upgrading the original single database

The old SQL and snapshots are retained unchanged in `apps/api/legacy-migrations/`. New domain baselines are for fresh databases; never apply them over the old database. The copy tool preserves IDs, dates, OAuth credentials, sessions, private records, balances, orders and receipts. It refuses populated destinations, leaves the source untouched, and verifies every copied column/value plus local foreign keys. Backup SQL contains private data: store it in an ignored location with restricted permissions and never commit it.

1. Keep the old deployment configuration as `source.json` with its `DB` binding. Create three fresh D1 resources and a target configuration with the new bindings and migration paths. Keep all non-database settings and runtime secrets unchanged.
2. Stop writes during cutover. Deploy the new API with `DATABASE_MAINTENANCE="true"` and all three domain bindings temporarily pointing to the original database. `/api/health` must report `maintenance: true`; other routes return 503 with Retry-After. Stripe will retry webhooks. Wait for in-flight requests to finish before exporting. Also pause any other Worker/cron/admin writes to the source.
3. Run the copy with the old source and fresh target configurations:

   ```bash
   pnpm db:split --remote --source-config source.json --target-config target.json \
     --backup-dir .wrangler/database-backup-unique-name \
     --maintenance-url https://your-api.example/api/health
   ```

   For local development use `--local` instead of `--remote`, omit `--maintenance-url`, stop the local API, and pass `--persist-to apps/api/.wrangler/state`. Existing local auth cookies keep working because identities and signing secrets are unchanged. Run with exported Cloudflare credentials or the encrypted root dotenvx environment. A failed copy leaves the source unchanged; inspect the private backup and use fresh destinations for a new attempt.

4. Update the deployment configuration/CI `CLOUDFLARE_WORKER_CONFIG` to the verified targets. Deploy with the three real bindings while still in maintenance, then remove `DATABASE_MAINTENANCE` and deploy. Verify an existing signed-in session, owned product data, billing balance, checkout and a public request.
5. Keep the original database and backup for rollback review. Once writes resume, a rollback to that snapshot would lose subsequent updates: do not switch back casually. Retire it deliberately after the cutover has been accepted.

Cloudflare references: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
