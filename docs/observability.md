# PostHog

Both frontends share `@workspace/observability/browser`. The API uses its separate `server` entry, so browser bundles never include the Node SDK or management credentials. Everything is optional: without a project token and host, there are no PostHog requests or consent controls.

## Connect a project

Use a dedicated project for each application. An agent with the connected PostHog app can create the project and configure replay. Alternatively, the CLI can provision a project and reporting dashboard using an existing personal API key:

```sh
export POSTHOG_MANAGEMENT_HOST=https://eu.posthog.com
export POSTHOG_ORGANIZATION_ID=YOUR_ORGANIZATION_UUID
# Supply POSTHOG_PERSONAL_API_KEY through your secret manager/environment.
# Scopes: project:read/write, dashboard:read/write, insight:read/write.
export POSTHOG_PROJECT_NAME='Cloudflare Starter'
pnpm posthog:setup
pnpm setup:local
pnpm cloud:up my-demo
```

Set `POSTHOG_PROJECT_ID` to configure an existing project explicitly. `posthog:setup` enables replay and IP anonymization and disables replay console capture in that project. It creates three tagged insights (engagement, API health and errors) and reuses them on subsequent runs. It preserves later manual changes to those insights. Project names are unique within an organization; the CLI resolves the project before writing. Use a distinct `APP_ENV` for each deployment. Reports default to `production`, while local capture defaults to `development`.

Setup writes only the public collection token, ingestion host and project ID into the ignored `apps/api/.dev.vars` (or `STARTER_ENV_FILE`). The personal API key stays in your environment; it is never deployed. The Cloudflare deployment keeps the analytics project: `cloud:down` removes Cloudflare resources, not your analytics history. No account or personal API key is fabricated by setup; an authenticated connection is required once.

To configure an already prepared project without management access, set:

```dotenv
POSTHOG_KEY=phc_YOUR_PUBLIC_PROJECT_TOKEN
POSTHOG_HOST=https://eu.i.posthog.com
APP_ENV=development
```

Use `https://us.i.posthog.com` for US projects. Ingestion and management hosts differ. The CLI targets PostHog Cloud; extend its explicit host validation for self-hosting. Enable session replay in the target project if configuring manually.

`pnpm setup:local` copies public settings into both ignored frontend `.env.local` files, preserving unrelated values. `pnpm cloud:up NAME` supplies them to both builds and the Worker. For manual deployment, set `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` and `VITE_APP_ENV` on the frontend build, and `POSTHOG_KEY`, `POSTHOG_HOST` and `APP_ENV` on the API. Never put a `phx_` personal key in any `VITE_` variable.

## Events and diagnosis

| Event                     | Purpose                                                                            | Properties                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `$pageview`, `$pageleave` | Landing engagement and navigation                                                  | Safe page URL, app, environment, session                                         |
| `template.opened`         | Main template CTA                                                                  | App and environment                                                              |
| `waitlist.joined`         | Successful signup                                                                  | App and environment; no submitted values                                         |
| `api.request.failed`      | Browser API failures                                                               | Route template, status, backend request ID                                       |
| `api.request`             | Worker traffic, errors, rate limits and latency                                    | Method, route template, status, duration, request ID                             |
| `$exception`              | Browser crashes, route errors, unhandled rejections and unexpected Worker failures | Error type, sanitized stack locations, app/environment and request ID on the API |

Browser API failures carry the same `request_id` as the Worker's response and operational event. Filter by that ID to trace one failure. Backend events use random per-request identities and do not create person profiles. API keys, cookies, request/response bodies, filenames, user emails and IPs are not sent by the application telemetry. Health checks and preflight requests are excluded. API metrics cover the Google, D1, R2, Stripe, email and metered endpoint examples through the shared request boundary. A failed dependency response can appear as a 5xx operational event without a JavaScript exception.

Unexpected errors retain their type and stack locations; messages, causes and source-code context are removed. This intentionally limits debugging of data-dependent failures. Source maps are not uploaded by this starter; stack locations refer to deployed bundles. Browser SSR failures are recorded when the rendered error boundary hydrates and analytics is allowed; requests that never hydrate remain in Cloudflare logs.

Cloudflare Workers observability is enabled, with structured request logs using the same request ID. PostHog receives operational events, not a copy of arbitrary console output. SDK clients are scoped to each Worker invocation and flushed in `ctx.waitUntil`; a three-second request timeout and no retries bound telemetry failures. They do not delay the HTTP response. Adjust sampling/retention for your traffic volume.

```sh
pnpm setup:doctor
pnpm posthog:report  # last seven days, using your management credentials; query:read scope
```

The report returns engagement counts, per-route requests/5xx/429/p95 duration and error counts. Setup prints direct links to the dashboard, Error Tracking and Session Replay. Empty reports are not evidence of working ingestion. After deployment, allow analytics, visit a few pages and submit the waitlist; then verify those events in the chosen project. Use Error Tracking to open a crash's linked recording. Test failures locally rather than adding a public crash endpoint.

## Privacy and reuse

Browser analytics and replay start only after explicit consent. Users can reopen **Analytics preferences** and withdraw it. Each frontend origin stores its own preference; this avoids sharing identifiers with unrelated Leitware projects. Signed-in dashboard sessions use the opaque account ID without name/email properties; logout resets identity. Anonymous marketing sessions are not joined across origins automatically.

Replay masks all text, input values and element attributes, blocks media and iframes, and excludes console/network bodies and headers. URL queries, hashes and unknown route segments are removed. Autocapture, heatmaps, remote SDK scripts and automatic exception capture are disabled; explicit typed events and sanitized exception handlers are used instead. Add `.ph-no-capture` to any new sensitive subtree. Revisit these choices and the privacy notice when adapting the template.

To add an event, extend `Events` in `packages/observability/src/browser.ts`, then use `track(name, properties)`. Extend the route allowlist in `privacy.ts` when adding routes. Keep free-form user content out of event properties. Use `observedFetch` for browser REST calls and keep backend work inside the Worker request boundary.

## Validation

```sh
pnpm test:setup
pnpm test:browser tests/observability.spec.ts
pnpm test:dev tests/observability.spec.ts
```

Tests exercise the real SDK against intercepted/local transports, including consent, replay masking, URL/message redaction, request correlation, identity reset, SDK flushing, provider outages, and repeatable scoped management setup. Tests never send fixture events to your live project. The management API fixture verifies request shapes and reruns; live API permissions, query execution, ingestion and replay must still be checked against the connected account.

References: [Workers integration](https://posthog.com/docs/libraries/cloudflare-workers), [JavaScript configuration](https://posthog.com/docs/libraries/js/config), [replay privacy](https://posthog.com/docs/session-replay/privacy), [API authentication](https://posthog.com/docs/api).
