# PostHog

Both frontends share `@workspace/observability/browser`. The API uses its separate `server` entry, so browser bundles never include the Node SDK or management credentials. Everything is optional: without a project token and host, there are no PostHog requests or consent controls.

For a first setup, start with [Getting started](getting-started.md). For proof of live events, errors and playable replay, use the [verification checklist](verification.md#posthog-events-errors-and-replay).

## Connect a project

Use a dedicated PostHog project, created through its dashboard or an authenticated connector. Enable session replay and IP anonymization; disable replay console capture in the project settings. Copy the public collection token and regional ingestion host into `apps/api/.dev.vars`:

```dotenv
POSTHOG_KEY=phc_YOUR_PUBLIC_PROJECT_TOKEN
POSTHOG_HOST=https://eu.i.posthog.com
APP_ENV=development
```

Use `https://us.i.posthog.com` for US projects. `pnpm setup:local` copies these public settings into both ignored frontend `.env.local` files, preserving unrelated values. Use a distinct `APP_ENV` per deployment.

For deployment, set `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` and `VITE_APP_ENV` on frontend builds, and `POSTHOG_KEY`, `POSTHOG_HOST` and `APP_ENV` on the API Worker. Never put a personal API key in a `VITE_` variable. The template needs no PostHog management credential or custom provisioning script.

Create dashboards or query events in PostHog directly. Useful views are engagement, per-route requests/5xx/429/p95 duration and errors, filtered to the deployment environment.

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

Cloudflare Workers observability is enabled, with structured request logs using the same request ID. PostHog receives operational events, not a copy of arbitrary console output. SDK clients are scoped to each Worker invocation and flushed in `ctx.waitUntil`; a three-second request timeout and no retries bound telemetry failures. They do not delay the HTTP response. Provider failure bodies and network error causes are removed before SDK diagnostic logging. Adjust sampling/retention for your traffic volume.

After deployment, allow analytics, visit pages and submit the waitlist; verify events in the chosen project's Activity view. Use Error Tracking to open a crash's linked recording. Empty reports are not proof of working ingestion. Test failures locally rather than adding a public crash endpoint.

## Privacy and reuse

Browser analytics and replay have independent opt-in choices. Users can reopen **Privacy preferences** and withdraw either purpose. Global Privacy Control disables both in this template. See [privacy and consent](privacy-consent.md) for the behaviour, regulatory context and launch requirements. Each frontend origin stores its own preference; this avoids sharing identifiers with unrelated Leitware projects. Signed-in dashboard sessions use the opaque account ID without name/email properties; logout resets identity. Anonymous marketing sessions are not joined across origins automatically.

Replay masks all text, input values and element attributes, blocks media and iframes, and excludes console/network bodies and headers. URL queries, hashes and unknown route segments are removed. Autocapture, heatmaps, remote SDK scripts and automatic exception capture are disabled; explicit typed events and sanitized exception handlers are used instead. Add `.ph-no-capture` to any new sensitive subtree. Revisit these choices and the privacy notice when adapting the template.

To add an event, extend `Events` in `packages/observability/src/browser.ts`, then use `track(name, properties)`. Extend the route allowlist in `privacy.ts` when adding routes. Keep free-form user content out of event properties. Use `observedFetch` for browser REST calls and keep backend work inside the Worker request boundary.

## Validation

```sh
pnpm test:unit
pnpm test
```

Local tests cover consent-record validation, URL/message redaction, API request correlation, server SDK flushing and provider outages against local transports. Tests never send fixture events to your live project. Check browser consent gates, replay masking, identity reset, withdrawal, live ingestion and playable replay manually using the [verification guide](verification.md). CI does not run these test suites.

References: [Workers integration](https://posthog.com/docs/libraries/cloudflare-workers), [JavaScript configuration](https://posthog.com/docs/libraries/js/config), [replay privacy](https://posthog.com/docs/session-replay/privacy), [API authentication](https://posthog.com/docs/api).
