# Project structure: the one-page guide

OpenAPI defines the public API. Orval generates its HTTP plumbing, models, schemas, frontend hooks and mocks. Effect gives handlers typed success and failure channels; Drizzle checks database queries. Every application endpoint uses this flow; todos are the smallest example.

```text
OpenAPI root → feature contracts + shared schemas
                         ↓ Orval
Hono routes + Effect contracts + frontend hooks + mocks
                         ↓ implementation
HTTP handler → application service → repository contract
                         ↑ Layer supplies implementation
                  Drizzle adapter → Cloudflare D1
```

## Where things live

| Location                                             | Responsibility                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/marketing`, `apps/dashboard`                   | TanStack Start websites and UI.                                                    |
| `packages/contracts/openapi/api.json`                | Metadata, default session security and explicit references to feature paths.       |
| `packages/contracts/openapi/features/<feature>.json` | Related operations, public schemas and response statuses.                          |
| `packages/contracts/openapi/shared/`                 | Reusable schemas, errors and responses.                                            |
| `apps/api/src/features/<feature>/`                   | HTTP entry handlers, application capabilities, domain rules and concrete adapters. |
| `packages/data/src/{identity,billing,product}.ts`    | Domain storage schemas; independent migrations in `apps/api/migrations/<domain>/`. |
| `src/generated/` directories                         | Generated routes, schemas, contracts, client models, hooks and mocks.              |

`orval.config.ts` uses native multi-file references, tag grouping, cleaning and formatting. `codegen/effect-handlers.ts` is the one custom extension: it adds typed Effect handler contracts, wiring and missing implementation stubs. `scripts/` contains small local setup and migration checks; `tests/` separates unit, API integration and shared support code. Wrangler handles deployment.

## Add a feature

1. Add or extend a plural feature file, such as `users.json`. Use unique camelCase operation IDs and one kebab-case tag matching the feature name.
2. Reference each path in `api.json` with an ordinary OpenAPI `$ref`.
3. Run `pnpm api:generate`. Missing handler entry points are created; existing implementations are preserved.
4. Keep transport validation/error mapping in the generated handler entry point. Put policy in a feature service, with dependencies supplied through request-scoped Layers. Use the generated frontend hooks.
5. Run `pnpm check`. TypeScript rejects unfinished stubs. Review regenerated files before committing.

Shared adapters validate requests and each declared status/body pair at runtime. Generated types check expected failures; business logic still owns permissions and unexpected defects become sanitized 500 responses. Drizzle's storage schema stays separate from the public contract, with query results checked against generated response types.

Todos, storefront, account/config, billing, checkout, keys, waitlist, email, metered API calls, files and the Stripe webhook all use this pattern. Public operations declare `security: []`; cookie sessions are the default, with explicit API-key and Stripe security schemes. The adapter supports JSON, binary transfers, signed raw bodies, path/query/header parameters and bodyless responses. Better Auth alone remains a delegated Hono mount because it owns OAuth redirects and cookies. See the [API walkthrough](api-architecture.md) for examples and limitations, and [deployment](manual-deployment.md) for provider setup.

Storage is split into identity, billing and product D1 databases. See [database boundaries](databases.md) for ownership, consistency and migration from the original database.

## Rules that survive new features

| Smell                        | Design rule and review question                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implicit coupling            | Declare dependencies as Effect services; provide bindings and identity at the entry point. Can the workflow run with test Layers?                |
| Layer-first folders          | Keep one capability together under features/. Does a change require unrelated technical folders?                                                 |
| Duplication                  | Own contracts, queries and business rules once. Are repeated expressions actually the same knowledge?                                            |
| Representable illegal states | Use validated values and unions with state-specific data. Can an internal caller construct an invalid state?                                     |
| God files                    | Group by a coherent reason to change. Does this module mix unrelated capabilities?                                                               |
| Shotgun surgery              | Centralise policy and depend on stable capability contracts. Does a new provider or rule require editing every consumer?                         |
| Layering violations          | Application code depends on contracts; runtime supplies adapters. Does a workflow know about HTTP or a concrete database?                        |
| Pass-through wrappers        | Every boundary must own policy, validation, lifetime or implementation isolation. What does this extra hop protect?                              |
| Misplaced validation/errors  | Decode every external source; enforce domain invariants; translate errors at the relevant boundary. Are defects or interruption being swallowed? |

`pnpm lint` rejects backend any/non-null assertions, direct prepare/exec calls, and infrastructure/HTTP imports or ambient I/O in application/domain modules. Unit fixtures prove both rejection and allowed adapter cases. Type checking, generation checks and public-boundary tests cover contract/state consistency and ownership. These checks run in CI and `pnpm check`; cohesion, semantic duplication and the value of an abstraction still require review. Do not use file-size limits or wrapper counts as substitutes.

See [application services and boundaries](api-architecture.md#application-services-and-boundaries) for the todo example and the provider adapters' current limitations. These backend rules do not change frontend conventions.
