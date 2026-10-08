# Data, API contracts and email

## One schema across the stack

`packages/data/src/schema.ts` owns the SQLite schema. `database(env.DB)` creates a Drizzle D1 client; Better Auth uses its Drizzle adapter too. The adapter maps the original ISO-string `date` columns to JavaScript `Date`, preserving existing sessions and users.

Use Drizzle's `$inferSelect` and `$inferInsert` exports for database code. Public REST types in `@workspace/contracts` derive from those rows with `Pick`/`Omit`. The API explicitly selects public columns; hashes, OAuth tokens, internal email addresses and owner IDs do not appear in those read models. R2 and Stripe have separate transport types because they are not database rows.

```ts
import { database } from '@workspace/data/client'
import { todos, type NewTodo } from '@workspace/data/schema'
import { eq } from 'drizzle-orm'

const db = database(env.DB)
const values = {
	id: crypto.randomUUID(),
	user_id: user.id,
	title: 'Ship an idea',
} satisfies NewTodo
await db.insert(todos).values(values)
const rows = await db.select().from(todos).where(eq(todos.user_id, user.id))
```

`inputs` contains strict Zod request schemas. API handlers validate with `input(request, 'createTodo')` and return checked response contracts with `reply('todo', { todo })`. React hooks use `client.get('todos')` and `client.mutate('createTodo', { title })`; their results and request bodies infer from the same contracts. Database imports into contracts are type-only, so the browser does not bundle the D1 client or auth schema. JSON response decoding is one trusted serialization boundary in `packages/contracts/src/client.ts`; it is compile-time checked against our API, not runtime validation of a third-party server.

Credit charging and Stripe grants still use atomic Drizzle D1 batches. Guarded insert/select statements keep their conditions inside SQL, with bound parameters and schema column references. D1 does not support interactive transactions; don't turn these batches into separate awaited writes. Concurrent debit, rollback, replay and webhook/poll races are tested.

## Migrations

```bash
# Edit packages/data/src/schema.ts first.
pnpm db:generate --name add_my_feature
# Review generated SQL, then apply it locally.
pnpm db:migrate
pnpm db:check
```

Commit SQL and `apps/api/migrations/meta` together. Wrangler applies migrations both locally and during `cloud:up`; never use `drizzle-kit push` against an existing deployment. `db:check` checks the journal and generates into a disposable directory to detect schema changes without migrations. It does not modify your database.

Migrations 0001–0005 are preserved. The timestamped `drizzle_baseline` is an intentional no-op with a snapshot of their schema; later migrations are generated normally. Fresh databases apply the legacy migrations first, and existing databases retain their data. The upgrade test seeds users, sessions, waitlist entries, todos and balances before applying the new migrations. Review table rebuilds carefully when changing SQLite columns, particularly foreign keys and constraints.

## Cloudflare email

The API uses Cloudflare's native `EMAIL` binding and two server-owned text/HTML templates. A new waitlist signup gets one confirmation when email is configured. Duplicate signups do not resend. Saving a signup remains successful if email fails.

Signed-in users can select **Send me a test**, which posts `{ requestId: crypto.randomUUID() }` to `/api/email`. The server chooses the verified session email; callers cannot provide recipients, senders or content. Requests require a trusted Origin and are limited to three per hour per user. `GET /api/email` lists that user's ten latest test attempts.

`email_deliveries` records each attempt before contacting the provider. A unique key prevents concurrent sends and retries from sending twice. An accepted retry returns the same message ID. Failed or interrupted attempts are not automatically retried: a timeout might mean the provider accepted the email. Inspect provider logs before deliberately using a new request ID. This is a small synchronous sending example, not a background queue with guaranteed delivery. `accepted` means provider acceptance, not inbox delivery; bounces and spam filtering remain possible.

### Local simulation

Set `EMAIL_FROM=starter@example.test` in your ignored `apps/api/.dev.vars`, then run `pnpm dev`. The tracked `send_email` binding has no `remote: true`; Wrangler simulates sending and prints paths to the text/HTML files. API and browser tests use that simulator, including injected failure tests. No real mail is sent by automated tests. See [Cloudflare's local email documentation](https://developers.cloudflare.com/email-service/local-development/sending/).

### Agent setup for live sending

Use an authorized Cloudflare API token with the required Email Sending permissions and zone read access. Set these in your shell or ignored `.dev.vars`:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-authorized-token
EMAIL_FROM=hello@mail.your-domain.example
```

```bash
pnpm email:setup
pnpm email:check
pnpm cloud:up my-demo
```

`email:setup` validates zone ownership, finds the exact sending domain and creates/enables it only when needed using the [Email Sending domain API](https://developers.cloudflare.com/api/resources/email_sending/subresources/subdomains/methods/create/). Cloudflare account entitlement and domain verification must be available. It reports the DKIM selector and return-path domain; API success does not verify inbox delivery. Follow [domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/) for DNS verification if Cloudflare reports an incomplete setup. `cloud:up` adds a binding restricted to `EMAIL_FROM`; without that variable, email stays disabled and the rest of the app deploys normally. No separate email API key is needed in the Worker.

The sender domain is shared account configuration. It is deliberately retained when `cloud:down` removes a project. Do not use an unrelated domain for a temporary test. Automated setup tests use a fake provider transport and create no domain/DNS resources.

For a real delivery check, choose an inbox you control, join the deployed waitlist with consent, and check both the inbox and provider logs. Then sign in and send yourself a test. Inspect the saved message ID/status in D1. Configure any account recipient restrictions required by Cloudflare. An agent can perform the setup and API steps with authorized access; account signup, entitlement, MFA and ownership verification cannot be bypassed.
