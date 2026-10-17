# OpenAPI → Orval → Hono + Effect

The todo feature uses this architecture end to end. Each feature owns a small OpenAPI fragment. Orval resolves their standard `$ref` links into one valid OpenAPI document and produces routes, Effect schemas and handler contracts, frontend query/mutation hooks, and MSW mocks.

```mermaid
flowchart TD
    Features["Feature contracts: todos, users, products"] -.-> Bundle["Assembled OpenAPI document"]
    Shared["Shared schemas, errors and responses"] -.-> Bundle
    Bundle -.-> Orval
    Orval -.-> Routes["Combined Hono router"]
    Orval -.-> Schemas["Effect schemas for each status"]
    Orval -.-> Client["Frontend hooks, models and mocks by feature"]
    Orval -.-> Extension["Effect extension: contracts and handler wiring"]
    UI["Dashboard"] <--> Client
    Client <-->|HTTP| Routes
    Routes <--> Boundary["Authentication, validation and Effect execution"]
    Boundary <--> Handlers["Handwritten feature handlers"]
    Handlers <--> Drizzle["Typed Drizzle queries"]
    Drizzle <--> D1[("Cloudflare D1")]
```

Dotted arrows represent generation. Solid arrows represent runtime calls. Users and products illustrate future feature modules; todos and the public storefront are migrated.

## Contract ownership

```text
packages/contracts/openapi/
  api.json                  API metadata, session security and explicit path references
  shared/
    errors.json             Reusable error schemas and HTTP responses
  features/
    todos.json              All todo routes and domain schemas
```

Add `users.json`, `products.json`, or another plural feature name under `features/`. Keep related operations in that feature's file. Larger features can be split when there is a real domain boundary. Shared definitions belong in `shared/`. Register paths explicitly in `api.json`; Orval resolves referenced files without a directory scanner.

Feature files contain `paths` and `components`. A local reference such as `#/components/schemas/Todo` resolves within its own file. Shared responses use relative references such as `../shared/errors.json#/components/responses/Unauthorized`. Choose descriptive PascalCase component names; Orval normalizes the referenced documents into one API.

The root path index uses standard JSON Pointer escaping (`~1` for `/`):

```json
{
	"paths": {
		"/api/todos": { "$ref": "./features/todos.json#/paths/~1api~1todos" },
		"/api/todos/{id}": { "$ref": "./features/todos.json#/paths/~1api~1todos~1{id}" }
	}
}
```

Add one reference per path, including new paths in an existing feature. Adding another method to an already referenced path needs no new root reference. Keep these references repository-local; the parser's external-reference permission allows Orval to load the feature and shared files.

Each operation has a globally unique camelCase `operationId` and one lowercase kebab-case tag matching its feature filename. For example, `getProduct` in `products.json` uses `tags: ["products"]`.

## Adding routes

1. Add operations to an existing feature file, or create another file in `openapi/features/`. Define public inputs, success responses, and typed error responses there. Use the reusable responses in `shared/errors.json` for boundary errors.
2. Reference new paths from `api.json`, then run `pnpm api:generate` (the native Orval CLI). No router imports or handwritten handler registry changes are needed.
3. Implement the new entry points created under `apps/api/src/features/<feature>/<operation-in-kebab-case>.ts`. Each is annotated with its generated Effect handler type. Regeneration never overwrites existing entry points, even when an operation is removed.
4. Use the generated frontend hooks and functions in `apps/dashboard/src/generated/<feature>.ts`.
5. Run `pnpm check`. The unresolved `TODO_IMPLEMENT_OPERATION` expression makes unfinished stubs fail ordinary TypeScript checking. Regenerate after contract changes and review changed or untracked output before committing. Naming conventions above are authoring conventions; there is no separate custom naming/collision scanner.

For example, adding `getProduct` to `features/products.json` creates:

```text
apps/api/src/features/products/get-product.ts         Handwritten implementation entry point
apps/api/src/generated/products.handlers.ts           Generated adapter wiring
packages/contracts/src/generated/products.effect.ts  Generated runtime schemas
apps/dashboard/src/generated/products.ts              Generated calls and query hooks
apps/dashboard/src/generated/products/products.msw.ts Generated mocks
```

The central `apps/api/src/generated/routes.ts`, `packages/contracts/src/generated/operations.ts`, and frontend `api.schemas.ts` update automatically. `packages/contracts/src/generated/openapi.json` is the complete Orval-normalised document for documentation and external tooling; edit the source fragments rather than this generated bundle.

Removing an operation removes its generated wiring and preserves the old implementation for review; remove obsolete implementation files when their generated types are no longer available.

One operation gets one implementation file. Put shared queries and services beside those files when useful. Todos currently share database projection/query helpers in `apps/api/src/features/todos/repository.ts`.

## Start with these files

| File                                             | Purpose                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `packages/contracts/openapi/features/todos.json` | Example feature contract.                                                                 |
| `packages/contracts/openapi/shared/errors.json`  | Shared error schemas and reusable responses.                                              |
| `orval.config.ts`                                | Configures all features together using Orval's tag-based grouping.                        |
| `codegen/effect-handlers.ts`                     | Extends native Effect generation with contracts, wiring and missing handler stubs.        |
| `packages/contracts/src/generated/operations.ts` | Generated registry re-exporting feature inputs, success/failure unions and handler types. |
| `apps/api/src/features/todos/get-todo.ts`        | Example typed Effect handler with an owned-record lookup.                                 |
| `apps/api/src/contract/handler.ts`               | Shared authentication, bounded JSON parsing, input validation, and Effect execution.      |
| `packages/contracts/src/http.ts`                 | Validates response status/body pairs on both sides.                                       |
| `apps/dashboard/src/generated/todos.ts`          | Generated HTTP functions and TanStack Query hooks.                                        |
| `apps/dashboard/src/generated/api.schemas.ts`    | Shared generated frontend models.                                                         |
| `apps/dashboard/src/lib/contract-fetch.ts`       | Response validation, typed errors, network errors, and session redirects.                 |

## Typed handlers and errors

`GetTodoHandler<ApiRequest>` is generated as an operation returning `Effect<GetTodoSuccess, GetTodoFailure, ApiRequest>`. The failure union pairs each declared HTTP status with its corresponding body. A 404 carries the `todo_not_found` body; a forbidden body cannot accidentally be used for that status.

There are no handwritten response interfaces, error classes, or status mappings per operation. Business logic still decides when an error applies. Drizzle owns storage and migrations; queries explicitly select public fields and must satisfy the generated API types.

Expected failures become their declared HTTP response. Infrastructure failures and unexpected defects reach the existing reporting boundary and become a sanitized, contract-validated 500. The frontend validates the same schemas; generated query and mutation errors distinguish typed `ApiError<OperationResponseError>`, `TransportError`, and `ContractViolation`. `ApiError.response` retains the discriminated status/data pair.

## Generation and verification

`orval.config.ts` uses native multi-file input and Orval's custom client and `extraFiles` extension points. Native Effect generation emits schemas; the extension adds operation contracts beside them and re-exports them through the operation registry. Native Hono generation owns the combined routes file. A post-write hook removes unused duplicate TypeScript models from the Effect output. No separate OpenAPI parser or second route generator is maintained.

All `src/generated/` directories are owned by generation. Orval cleans those specific directories and writes formatted output directly. Handwritten feature directories are outside the clean targets. If generation fails, correct the contract and rerun it; output is not staged atomically. Review Git status for tracked changes and new files after generation, including missing handler entry points.

Tests exercise a temporary second products feature, native shared references, router/type/client/mock generation, preserved implementations, TypeScript rejection of unfinished handlers, unsupported boundary rejection, and removal of stale generated outputs. Separate local contract tests and Worker integration tests cover response validation, authentication, CSRF, ownership, malformed requests, and real database behaviour. Mocks are development helpers rather than independent evidence of correct behaviour.

## Deliberate boundaries

All five todo operations and the three public storefront operations are migrated. Better Auth, billing/Stripe, files, keys, waitlist, and email retain their existing contracts and handlers. The free API-key todo endpoint reuses the typed query.

The current adapter supports explicit 2xx/4xx/5xx statuses, required JSON request bodies, JSON responses, path parameters, cookie-session security, and bodyless 204 responses. Shared response/schema references are supported. Unsupported parameter locations, optional bodies, and media types are rejected. Every operation declares 400/401/403/500/503 responses, plus 413/415 when it accepts a body. Cookie-session security defaults come from `api.json`; only explicit `security: []` operations use the public boundary. Public handlers receive request/environment context without a user identity, retain trusted-Origin checks, and own their rate limits.

Orval does not generate Effect handler signatures or preserve `minProperties` in its Effect output. The Orval extension supplies those pieces. The shared Effect boundary replaces Hono's stock response validators and covers every declared status. Effect 4 is used here; Zod remains for the integrations that have not migrated.
