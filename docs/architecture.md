# Project structure: the one-page guide

The API contract is the starting point. Define a feature once in OpenAPI; generate its HTTP plumbing and types; write its behaviour with Effect and Drizzle. Todos demonstrate the complete flow today.

```text
OpenAPI feature + shared schemas
               ↓ generation
Hono routes + Effect contracts + frontend hooks + mocks
               ↓ implementation
Effect handler → typed Drizzle query → Cloudflare D1
```

## Where things live

| Location                                             | Responsibility                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/marketing`, `apps/dashboard`                   | TanStack Start websites and UI.                                                     |
| `packages/contracts/openapi/api.json`                | API metadata and default session security.                                          |
| `packages/contracts/openapi/features/<feature>.json` | That feature's routes, public schemas, and response statuses.                       |
| `packages/contracts/openapi/shared/`                 | Reusable schemas, errors, and responses.                                            |
| `apps/api/src/features/<feature>/`                   | One handwritten Effect handler per operation; shared queries/services alongside it. |
| `packages/data/src/schema.ts`                        | Drizzle storage schema; migrations live in `apps/api/migrations/`.                  |
| `src/generated/` directories                         | Generated routes, schemas, contracts, frontend hooks, models, and mocks.            |

## Add a feature

1. Add a plural feature file such as `users.json`, or extend an existing one. Use unique camelCase operation IDs and a single kebab-case tag matching the filename.
2. Run `pnpm api:generate`. Features are discovered automatically; missing handler entry points are created once and existing implementations are preserved.
3. Implement the generated handler type with Effect and typed Drizzle queries. Use the generated frontend query/mutation hooks.
4. Run `pnpm check`. CI rejects stale output, naming collisions, and unfinished `TODO_IMPLEMENT_OPERATION` stubs.

The contract generates paired success/failure status and body types. Shared adapters validate requests and declared responses on both sides. Application code still owns permissions and business rules; unexpected defects become sanitized 500 responses. Never edit generated files or expose database rows wholesale.

Only todos currently use this pattern. Other starter integrations retain their existing handlers. The current adapter supports cookie sessions, JSON bodies/responses, path parameters, and bodyless 204 responses; extend it deliberately for additional transport patterns.

See the [detailed API walkthrough](api-architecture.md) for exact files, conventions, supported contract shapes, and tests. Local setup is in the [getting-started guide](getting-started.md).
