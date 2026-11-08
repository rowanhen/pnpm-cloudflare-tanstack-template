# Project structure: the one-page guide

OpenAPI defines the public API. Orval generates its HTTP plumbing, models, schemas, frontend hooks and mocks. Effect gives handlers typed success and failure channels; Drizzle checks database queries. Every application endpoint uses this flow; todos are the smallest example.

```text
OpenAPI root → feature contracts + shared schemas
                         ↓ Orval
Hono routes + Effect contracts + frontend hooks + mocks
                         ↓ implementation
HTTP handler → feature functions → owned repository → Cloudflare D1
                    ↑ explicit request-scoped dependencies
```

## Where things live

| Location                                             | Responsibility                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/marketing`, `apps/dashboard`                   | TanStack Start websites and UI.                                                    |
| `packages/contracts/openapi/api.json`                | Metadata, default session security and explicit references to feature paths.       |
| `packages/contracts/openapi/features/<feature>.json` | Related operations, public schemas and response statuses.                          |
| `packages/contracts/openapi/shared/`                 | Reusable schemas, errors and responses.                                            |
| `apps/api/src/features/<feature>/`                   | HTTP entry handlers, application capabilities, domain rules and concrete adapters. |
| `packages/data/src/{identity,billing,product}.ts`    | Feature schemas sharing one database; migrations in `apps/api/migrations/`.        |
| `src/generated/` directories                         | Generated routes, schemas, contracts, client models, hooks and mocks.              |

`orval.config.ts` uses native multi-file references, tag grouping, cleaning and formatting. `codegen/effect-handlers.ts` is the one custom extension: it adds typed Effect handler contracts, wiring and missing implementation stubs. `scripts/` contains small local setup and migration checks; `tests/` separates unit, API integration and shared support code. Wrangler handles deployment.

## Add a feature

1. Add or extend a plural feature file, such as `users.json`. Use unique camelCase operation IDs and one kebab-case tag matching the feature name.
2. Reference each path in `api.json` with an ordinary OpenAPI `$ref`.
3. Run `pnpm api:generate`. Missing handler entry points are created; existing implementations are preserved.
4. Keep transport validation/error mapping in the generated handler entry point. Put policy in typed Effect factories with explicit dependencies. Keep domain rules and persistence/provider adapters separate when they protect real invariants. Use the generated frontend hooks.
5. Run `pnpm check`. TypeScript rejects unfinished stubs. Review regenerated files before committing.

Shared adapters validate requests and each declared status/body pair at runtime. Generated types check expected failures; business logic still owns permissions and unexpected defects become sanitized 500 responses. Drizzle's storage schema stays separate from the public contract, with query results checked against generated response types.

Todos, storefront, account/config, billing, checkout, keys, waitlist, email, metered API calls, files and the Stripe webhook all use this pattern. Public operations declare `security: []`; cookie sessions are the default, with explicit API-key and Stripe security schemes. The adapter supports JSON, binary transfers, signed raw bodies, path/query/header parameters and bodyless responses. Better Auth alone remains a delegated Hono mount because it owns OAuth redirects and cookies. See the [API walkthrough](api-architecture.md) for examples and limitations, and [deployment](manual-deployment.md) for provider setup.

Identity, billing and product tables share one D1 database. See [database boundaries](databases.md) for ownership, consistency and migration from the original database.

## Rules that survive new features

| Smell                        | Design rule and review question                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implicit coupling            | Declare dependencies as small interfaces; provide bindings and identity at the entry point. Can the workflow run with fakes?                                  |
| Layer-first folders          | Keep one capability together under features/. Does a change require unrelated technical folders?                                                              |
| Duplication                  | Own contracts, queries and business rules once. Are repeated expressions actually the same knowledge?                                                         |
| Representable illegal states | Use validated values and unions with state-specific data. Can an internal caller construct an invalid state?                                                  |
| God files                    | Group by a coherent reason to change. Does this module mix unrelated capabilities?                                                                            |
| Shotgun surgery              | Centralise policy and depend on stable capability contracts. Does a new provider or rule require editing every consumer?                                      |
| Layering violations          | Application code depends on contracts; HTTP entry points or shared runtime factories supply adapters. Does a workflow know about HTTP or a concrete database? |
| Pass-through wrappers        | Every boundary must own policy, validation, lifetime or implementation isolation. What does this extra hop protect?                                           |
| Misplaced validation/errors  | Decode every external source; enforce domain invariants; translate errors at the relevant boundary. Are defects or interruption being swallowed?              |

`pnpm lint` combines Oxlint, `scripts/check-architecture.ts` the official Effect diagnostics (`pnpm lint:effect`) and the encrypted-configuration guard (`pnpm lint:env`). It rejects unsafe types/assertions, ambient application I/O/time, nested Effect execution, cross-feature private imports, dependency cycles, misplaced adapter imports and direct D1 calls. The graph check discovers HTTP entry points from generated wiring and treats other feature code as application code by default, so renaming a workflow does not bypass it. Feature `adapters/` directories permit arbitrary adapter filenames and cohesive workflow/persistence implementations without editing the checker. Pure feature modules still cannot import infrastructure. The pinned TypeScript compiler supplies AST/type information; Drizzle batches and regular-expression exec remain permitted.

Unit fixtures exercise rejected and permitted imports and typed database calls. Type checking, generation checks and public-boundary tests cover state consistency, ownership, failure recovery, cancellation and atomic billing. These checks run in CI and pnpm check. Cohesion, semantic duplication and the value of an abstraction still require review; do not substitute file-size limits or wrapper counts.

See [application services and boundaries](api-architecture.md#application-services-and-boundaries) for composition and the integration constraints. These backend rules do not change frontend conventions.

## Checkout UI

The storefront hook owns one typed checkout state: selecting, creating, ready or error. Product details and session credentials travel together. Attempts are retained per product until unmount so retries and Back reuse the same request ID and buyer proof; a session becomes ready only after its proof is saved for the provider redirect. Confirmation distinguishes confirming from redirecting and allows retry after failure.

Both payment-status routes share a 2.5-second polling interval with a 30-second deadline starting when processing is first observed. Refetch counts do not affect the deadline. Once automatic checking stops, the processing page keeps its manual refresh action. Each new mounted session gets its own verification window.
