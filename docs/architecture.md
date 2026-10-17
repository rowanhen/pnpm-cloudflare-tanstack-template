# Project structure: the one-page guide

OpenAPI defines the public API. Orval generates its HTTP plumbing, models, schemas, frontend hooks and mocks. Effect gives handlers typed success and failure channels; Drizzle checks database queries. Todos demonstrate the complete flow.

```text
OpenAPI root → feature contracts + shared schemas
                         ↓ Orval
Hono routes + Effect contracts + frontend hooks + mocks
                         ↓ implementation
Effect handler → typed Drizzle query → Cloudflare D1
```

## Where things live

| Location                                             | Responsibility                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/marketing`, `apps/dashboard`                   | TanStack Start websites and UI.                                              |
| `packages/contracts/openapi/api.json`                | Metadata, default session security and explicit references to feature paths. |
| `packages/contracts/openapi/features/<feature>.json` | Related operations, public schemas and response statuses.                    |
| `packages/contracts/openapi/shared/`                 | Reusable schemas, errors and responses.                                      |
| `apps/api/src/features/<feature>/`                   | One handwritten Effect handler per operation; queries/services alongside it. |
| `packages/data/src/schema.ts`                        | Drizzle storage schema; migrations are in `apps/api/migrations/`.            |
| `src/generated/` directories                         | Generated routes, schemas, contracts, client models, hooks and mocks.        |

`orval.config.ts` uses native multi-file references, tag grouping, cleaning and formatting. `codegen/effect-handlers.ts` is the one custom extension: it adds typed Effect handler contracts, wiring and missing implementation stubs. `scripts/` contains small local setup and migration checks; `tests/` separates unit, API integration and shared support code. Wrangler handles deployment.

## Add a feature

1. Add or extend a plural feature file, such as `users.json`. Use unique camelCase operation IDs and one kebab-case tag matching the feature name.
2. Reference each path in `api.json` with an ordinary OpenAPI `$ref`.
3. Run `pnpm api:generate`. Missing handler entry points are created; existing implementations are preserved.
4. Implement the generated handler types with Effect and Drizzle. Use the generated frontend hooks.
5. Run `pnpm check`. TypeScript rejects unfinished stubs. CI regenerates and rejects changed or newly generated files.

Shared adapters validate requests and each declared status/body pair at runtime. Generated types check expected failures; business logic still owns permissions and unexpected defects become sanitized 500 responses. Drizzle's storage schema stays separate from the public contract, with query results checked against generated response types.

Only todos currently use this pattern. The adapter supports cookie sessions, JSON bodies/responses, path parameters and bodyless 204 responses. See the [API walkthrough](api-architecture.md) for examples and limitations, and [deployment](manual-deployment.md) for provider setup.
