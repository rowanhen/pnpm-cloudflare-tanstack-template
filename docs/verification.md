# Verification and integration audit

Use this checklist after connecting an account or changing deployment URLs. The application tests and live provider checks answer different questions.

## Maintained demo: 8 October 2026

| Integration                  | Application coverage                                                                                                 | Live provider status                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker, D1 and R2 | API, ownership, rate limiting, migrations and browser CRUD                                                           | Passed on a fresh disposable deployment; API/browser checks and resource cleanup verified                                                                   |
| Prepaid API requests         | Debit/result transaction, rollback, concurrent retries, last credit, 402 and revocation                              | Real D1 metering is tested with seeded credits; end-to-end Stripe funding remains pending                                                                   |
| Google / Better Auth         | Server protection, OAuth state/PKCE, callback rejection/cancellation, sign-out and return paths                      | Live sign-in returns `redirect_uri_mismatch`; register the exact dashboard callback using Google Cloud account access, then complete consent/token exchange |
| Stripe                       | Real SDK/signature checks against local responses, order ownership, duplicate/reordered events, exact-once grants    | No test keys connected; real Payment Element card payment and webhook delivery unverified                                                                   |
| PostHog                      | Real SDK with local/intercepted collection, consent, replay masking, errors, request correlation and outage handling | Disabled on the demo; connected account requires reauthentication, so project ingestion/reporting/replay are unverified                                     |
| Cloudflare email             | Local HTML simulation, recipient restriction, deduplication and attempt records                                      | No sender connected; real inbox delivery unverified                                                                                                         |
| Composables / Kumo           | Shared components, mobile layout, page states and frontend builds                                                    | Present on the public demo                                                                                                                                  |

Public site: [devtemplate.leitware.com](https://devtemplate.leitware.com). Sign-in: [dashboard login](https://starter-showcase-18d8b58f-dashboard.pages.dev/login). Stripe checkout is intentionally test-only. This table is an audit record, not a runtime status monitor.

## Results from this audit

- `pnpm validate`: passed lint, formatting, schema/migration checks, local API tests, TypeScript and builds; **19 production-browser + 19 development-browser tests passed**.
- `pnpm test:remote`: real Cloudflare API/metering checks passed; **13 browser tests passed, 6 provider-fixture cases skipped**. Teardown independently confirmed both Pages projects, Worker, D1 and R2 were absent.
- `pnpm test:browser tests/observability.spec.ts`: **3 passed** after moving analytics preferences out of the content area. The SDK transport tests also cover redacted provider failure logs.
- Live Google handoff reproduced `redirect_uri_mismatch`. No real Google session, Stripe card payment, PostHog project ingestion/replay or inbox delivery was recorded.

## Automated checks

From the repository root, with ports 3000, 3001 and 8787 free:

```bash
pnpm validate
```

It runs lint, formatting, schema/migration checks, API tests, TypeScript, builds, and Chromium tests against both Vite development servers and production Pages runtimes. Tests create isolated local D1/R2, signed sessions and provider fixtures, then clean up. Fixtures never become a production login bypass. Analytics tests never send their events to your real project.

With authorized Cloudflare credentials:

```bash
pnpm validate --cloud
```

This adds a deployed API/browser suite and a repeatable provisioning/teardown test. The deployed suite uses real Workers, D1 and R2 with temporary users and seeded credits. Stripe and PostHog fixture cases are skipped there. The lifecycle test checks that rerunning setup preserves IDs and secrets, then deletes uploaded files and all owned cloud resources.

Individual commands: `pnpm check`, `pnpm test:browser`, `pnpm test:dev`, `pnpm test:remote`, `pnpm test:cloud-setup`. The browser commands also accept a spec path, for example `pnpm test:browser tests/checkout.spec.ts`.

For a retained deployment, `pnpm cloud:check my-demo` performs read-only health, proxy, login-protection, 404 and indexing checks. `pnpm setup:doctor --online` checks credential readiness and the provider API access it reports. Neither command completes sign-in, a card payment, replay viewing or inbox delivery.

## Google and private data

Follow the [Google guide](google-sign-in.md), then use a fresh browser session:

1. Visit the protected dashboard. Confirm it redirects to `/login` without rendering private data.
2. Sign in through Google's real consent flow. Create a todo; reload and check it persists.
3. Upload a small text file, download it and compare its contents, then delete it.
4. Create a **Todos** API key and call `GET /api/v1/todos` with `Authorization: Bearer YOUR_KEY`. Check only your records appear. Delete the key and repeat: expect 401.
5. Sign out. Reload the workspace and checkout: both must require sign-in.
6. Start sign-in from checkout and cancel Google consent. Confirm the retry message and the checkout destination. Finish sign-in and confirm checkout opens.

## Stripe and metered requests

Connect a dedicated sandbox using the [payment guide](payments.md). Use only Stripe test cards.

1. Note the signed-in user's credit balance. Open **Add credits**, continue to the Payment Element and complete a `4242 4242 4242 4242` test payment with future expiry and any three-digit CVC.
2. Confirm `/checkout/success` shows a verified payment and 1,000 credits added. Reload it; the balance must remain increased by exactly 1,000.
3. In Stripe's event delivery details, confirm the deployed webhook received a 2xx response. Status polling can also reconcile an order, so a success page alone is not proof of webhook delivery.
4. Create a **Summary · 1 credit** key and run the [metering curl example](pay-per-request.md#try-it). Expect HTTP 200 and `X-Credits-Charged: 1`.
5. Repeat the identical request and idempotency key. Expect the same result/receipt and `X-Credits-Charged: 0`. Refresh the dashboard balance; only one credit should have been spent.
6. Delete the key and repeat: expect 401. A **Todos** key calling the paid endpoint must return 403. A new unfunded user must receive 402. The automated suite verifies exhaustion and concurrency without manually spending a pack.
7. Repeat checkout with a decline and 3DS test card from the [payment guide](payments.md). An incomplete/declined payment must not add credits. The status URL alone must never grant access or credits.

The one-credit price is application billing. Cloudflare separately bills your infrastructure usage. This starter does not charge a card on every request or implement x402. Refund/dispute handling for real payments is outside this test-mode example.

## PostHog events, errors and replay

Connect the selected project using the [PostHog guide](observability.md). Record its region, project ID and environment so you do not inspect another project's traffic.

1. Deploy after configuring the public collection token and ingestion host. In a fresh browser session, decline analytics; there must be no browser PostHog requests. Server API operational events are independent of browser consent and contain no user content.
2. Choose **Analytics preferences**, allow analytics, then visit the landing and privacy pages. Follow **Use the template** and return. Check `$pageview` and `template.opened` in the selected project's live events.
3. Submit the waitlist with an address you control. Check `waitlist.joined` contains no submitted name/email. Inspect its session replay: input values, page text and attributes must be masked; payment frames and media must be blocked.
4. On the dashboard origin, opt in separately. Sign in, navigate, then sign out. Verify the opaque signed-in ID resets. Marketing and dashboard sessions are intentionally separate.
5. Trigger a harmless unauthorized request to `/api/v1/todos` without a key. Find `api.request` with route `/api/v1/todos`, status 401 and its response's `X-Request-Id`. Use the same ID when investigating browser/API failures.
6. For a real crash-to-replay check, use an isolated staging deployment with analytics allowed. In your own browser console, run `setTimeout(() => { throw new Error('starter-verification') }, 0)`. Find the `$exception` in Error Tracking and open its linked recording. The message is deliberately sanitized. Remove any staging fault injection afterward; no public crash endpoint is included. Visiting `/error` previews the UI and does not throw an exception.
7. Run `pnpm posthog:report` with management credentials and the same `APP_ENV`. Expect non-empty engagement/API results; the error report should include the staged crash. Open the replay itself: an accepted capture request alone does not prove it is playable.
8. Withdraw consent and repeat page navigation. No further browser analytics or replay should be sent.

A successful local SDK test, a present token, or an empty report is not proof of real project ingestion. Recording may take time to process; check blockers, consent, host/region and project settings if it does not appear.

## Email and waitlist

Connect the sender using the [email guide](data-and-email.md). Sign in with your own verified Google address, choose **Send me a test**, and check that inbox and spam folder. `accepted` means Cloudflare accepted the send request; it does not prove inbox delivery. Submit the waitlist separately to check its confirmation template and duplicate protection. Send only to addresses you control or have permission to use.

## Cleanup and evidence

Save command results and the provider/project/environment used, together with what actually passed. Do not put keys, cookies, authorization codes or real user data in logs or screenshots. Delete manual test todos/files and revoke temporary keys.

Cloud test runners verify absence of their uniquely named temporary Worker, D1, R2 and Pages projects. If interrupted, retain their manifest and retry:

```bash
pnpm test:remote --cleanup .wrangler/template-e2e-RUN-ID/resources.json
```

For your own disposable environment, `pnpm cloud:down my-demo` removes the resources owned by its manifest and archives its owned Stripe catalog. Stripe retains test payment history. PostHog and email domain configuration are retained; use dedicated test projects if their history must be removed. Keep the maintained `showcase` deployment.
