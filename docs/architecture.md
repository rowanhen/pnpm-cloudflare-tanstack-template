# Project structure: the one-page guide

OpenAPI defines the public API. Orval generates its HTTP plumbing, models, schemas, frontend hooks and mocks. Effect gives handlers typed success and failure channels; Drizzle checks database queries. Every application endpoint uses this flow; todos are the smallest example.

```text
OpenAPI root → feature contracts + shared schemas
                         ↓ Orval
Hono routes + Effect contracts + frontend hooks + mocks
                         ↓ implementation
Effect handler → typed Drizzle query → Cloudflare D1
```

## Where things live

| Location                                             | Responsibility                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/marketing`, `apps/dashboard`                   | TanStack Start websites and UI.                                                    |
| `packages/contracts/openapi/api.json`                | Metadata, default session security and explicit references to feature paths.       |
| `packages/contracts/openapi/features/<feature>.json` | Related operations, public schemas and response statuses.                          |
| `packages/contracts/openapi/shared/`                 | Reusable schemas, errors and responses.                                            |
| `apps/api/src/features/<feature>/`                   | One handwritten Effect handler per operation; queries/services alongside it.       |
| `packages/data/src/{identity,billing,product}.ts`    | Domain storage schemas; independent migrations in `apps/api/migrations/<domain>/`. |
| `src/generated/` directories                         | Generated routes, schemas, contracts, client models, hooks and mocks.              |

`orval.config.ts` uses native multi-file references, tag grouping, cleaning and formatting. `codegen/effect-handlers.ts` is the one custom extension: it adds typed Effect handler contracts, wiring and missing implementation stubs. `scripts/` contains small local setup and migration checks; `tests/` separates unit, API integration and shared support code. Wrangler handles deployment.

## Add a feature

1. Add or extend a plural feature file, such as `users.json`. Use unique camelCase operation IDs and one kebab-case tag matching the feature name.
2. Reference each path in `api.json` with an ordinary OpenAPI `$ref`.
3. Run `pnpm api:generate`. Missing handler entry points are created; existing implementations are preserved.
4. Implement the generated handler types with Effect and Drizzle. Use the generated frontend hooks.
5. Run `pnpm check`. TypeScript rejects unfinished stubs. Review regenerated files before committing.

Shared adapters validate requests and each declared status/body pair at runtime. Generated types check expected failures; business logic still owns permissions and unexpected defects become sanitized 500 responses. Drizzle's storage schema stays separate from the public contract, with query results checked against generated response types.

Todos, storefront, account/config, billing, checkout, keys, waitlist, email, metered API calls, files and the Stripe webhook all use this pattern. Public operations declare `security: []`; cookie sessions are the default, with explicit API-key and Stripe security schemes. The adapter supports JSON, binary transfers, signed raw bodies, path/query/header parameters and bodyless responses. Better Auth alone remains a delegated Hono mount because it owns OAuth redirects and cookies. See the [API walkthrough](api-architecture.md) for examples and limitations, and [deployment](manual-deployment.md) for provider setup.

Storage is split into identity, billing and product D1 databases. See [database boundaries](databases.md) for ownership, consistency and migration from the original database.
