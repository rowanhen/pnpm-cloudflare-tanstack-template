# Data, API contracts and email

## Domain schemas across the stack

The [three domain schemas](databases.md) own identity, billing and product storage. `productDatabase(env.PRODUCT_DB)` creates a product Drizzle client; Better Auth uses `identityDatabase(env.IDENTITY_DB)` with its Drizzle adapter. The adapter maps the original ISO-string `date` columns to JavaScript `Date`, preserving existing sessions and users.

Use Drizzle's `$inferSelect` and `$inferInsert` exports for database code. Public REST types come from OpenAPI, with typed Drizzle projections checked against generated responses. `@workspace/contracts` exposes aliases of those generated types. The API explicitly selects public columns; hashes, OAuth tokens, internal email addresses and owner IDs do not appear in those read models. File and checkout transport types are also generated from their OpenAPI features.

```ts
import { productDatabase } from '@workspace/data/client'
import { todos, type NewTodo } from '@workspace/data/product'
import { eq } from 'drizzle-orm'

const db = productDatabase(env.PRODUCT_DB)
const values = {
	id: crypto.randomUUID(),
	user_id: user.id,
	title: 'Ship an idea',
} satisfies NewTodo
await db.insert(todos).values(values)
const rows = await db.select().from(todos).where(eq(todos.user_id, user.id))
```

Todos use the [OpenAPI, Orval, Hono and Effect workflow](api-architecture.md). Edit `packages/contracts/openapi/features/todos.json`, run `pnpm api:generate`, and implement the generated Effect handler types in `apps/api/src/features/todos/get-todo.ts`. The dashboard uses generated TanStack Query hooks and HTTP functions. Both sides validate responses against the generated Effect schemas, including declared error status/body pairs.

Billing, checkout, keys, files, waitlist and email use the same generated contracts and shared validation boundary. The marketing waitlist uses a generated fetch client. Better Auth retains its provider-owned OAuth/session protocol behind a Hono mount.

Credit charging and Stripe grants still use atomic Drizzle D1 batches. Guarded insert/select statements keep their conditions inside SQL, with bound parameters and schema column references. D1 does not support interactive transactions; don't turn these batches into separate awaited writes. Concurrent debit, rollback, replay and webhook/poll races are tested.

## Migrations

```bash
# Edit packages/data/src/product.ts first.
pnpm db:generate --domain product --name add_my_feature
# Review generated SQL, then apply it locally.
pnpm db:migrate
pnpm db:check
```

Commit SQL and the selected domain’s `apps/api/migrations/<domain>/meta` together. Wrangler applies migrations through `pnpm db:migrate` locally and `pnpm db:migrate:remote` during deployment; never use `drizzle-kit push` against an existing deployment. `db:check` checks the journal and generates into a disposable directory to detect schema changes without migrations. It does not modify your database.

The original single-database migrations are preserved under `apps/api/legacy-migrations/`. New projects use independent domain baselines. Existing deployments must follow the [verified copy and cutover procedure](databases.md#upgrading-the-original-single-database); do not point a fresh binding at an old mixed schema.

## Cloudflare email

The API uses Cloudflare's native `EMAIL` binding and two server-owned text/HTML templates. A new waitlist signup gets one confirmation when email is configured. Duplicate signups do not resend. Saving a signup remains successful if email fails.

Signed-in users can select **Send me a test**, which posts `{ requestId: crypto.randomUUID() }` to `/api/email`. The server chooses the verified session email; callers cannot provide recipients, senders or content. Requests require a trusted Origin and are limited to three per hour per user. `GET /api/email` lists that user's ten latest test attempts.

`email_deliveries` records each attempt before contacting the provider. A unique key prevents concurrent sends and retries from sending twice. An accepted retry returns the same message ID. Failed or interrupted attempts are not automatically retried: a timeout might mean the provider accepted the email. Inspect provider logs before deliberately using a new request ID. This is a small synchronous sending example, not a background queue with guaranteed delivery. `accepted` means provider acceptance, not inbox delivery; bounces and spam filtering remain possible.

### Local simulation

Set `EMAIL_FROM=starter@example.test` in your ignored `apps/api/.dev.vars`, then run `pnpm dev`. The tracked `send_email` binding has no `remote: true`; Wrangler simulates sending and prints paths to the text/HTML files. Local API tests use that simulator, including injected failure tests. No real mail is sent by automated tests. See [Cloudflare's local email documentation](https://developers.cloudflare.com/email-service/local-development/sending/).

### Live sending

Configure and verify your sender domain through Cloudflare Email Service using [domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/). Account entitlement and DNS verification must be available. Set `EMAIL_FROM` on the API Worker with Wrangler, and restrict the binding in `apps/api/wrangler.json` to the same address:

```json
{
	"send_email": [
		{ "name": "EMAIL", "allowed_sender_addresses": ["hello@mail.your-domain.example"] }
	]
}
```

```bash
pnpm exec wrangler secret put EMAIL_FROM --config apps/api/wrangler.json
pnpm deploy:api
```

No separate email API key is needed in the Worker. Without `EMAIL_FROM`, email stays disabled and waitlist signups still save. Sender-domain setup is shared account configuration; manage it through Cloudflare separately from project deployment. Local tests create no domain or DNS resources.

For a real delivery check, choose an inbox you control, join the deployed waitlist with consent, and check both the inbox and provider logs. Then sign in and send yourself a test. Inspect the saved message ID/status in D1. Configure any account recipient restrictions required by Cloudflare. An agent can perform the setup and API steps with authorized access; account signup, entitlement, MFA and ownership verification cannot be bypassed.
