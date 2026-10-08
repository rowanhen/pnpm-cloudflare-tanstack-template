# Stripe test checkout

[Start here](getting-started.md) · [Pay per request](pay-per-request.md) · [Verification checklist](verification.md)

The signed-in dashboard has `/checkout` with a custom [Stripe Payment Element](https://docs.stripe.com/payments/quickstart?client=react) inside the app's shared UI. It uses Checkout Sessions (`ui_mode: elements`) for a **one-time test credit purchase**. `/checkout/success?session_id=...` checks the session on the server; visiting that URL alone never marks an order paid. It handles pending, incomplete, expired, missing, and confirmed orders.

1. In a dedicated Stripe sandbox, copy its **test** secret and publishable keys into the ignored `apps/api/.dev.vars`:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

2. Run `pnpm stripe:setup`. It creates a test **API credits** product and £12 one-time price, writes `STRIPE_PRICE_ID` locally, and saves an ignored resource manifest. It refuses to overwrite an existing price. The UI reads the product/price from Stripe, so you can replace `STRIPE_PRICE_ID` with your own active one-time test price.
3. Authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli) with `stripe login`, then run:

   ```bash
   stripe listen --forward-to localhost:8787/api/stripe/webhook
   ```

   Save the listener's signing secret as `STRIPE_WEBHOOK_SECRET=whsec_...` in `.dev.vars`. Restart `pnpm dev`. The listener must use the same sandbox as the keys.

4. Sign in with Google, open `/checkout`, choose **Continue to payment**, and use Stripe's [test cards](https://docs.stripe.com/testing): `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Also test a decline (`4000 0000 0000 0002`) and authentication (`4000 0025 0000 3155`). Only enter test details. Confirm that the success page adds 1,000 credits, refresh it, and check that the balance does not increase again.

No test keys are bundled with the template. It deliberately rejects live keys/events, restricts payment methods to cards, and disables adaptive pricing so the displayed and recorded currency match. Card details go directly to Stripe, never through the Worker or D1. Each verified purchase adds 1,000 API credits. The pack size is defined on the server in `apps/api/src/billing.ts`; new orders snapshot it before contacting Stripe.

**Cloud deployment:** configure `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` on the API Worker with `wrangler secret put`. For a new sandbox setup, `pnpm stripe:setup https://YOUR-API.workers.dev/api/stripe/webhook` also creates a signing endpoint and saves its secret locally. If reusing an existing price, add that webhook in Stripe's dashboard. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`, using API version `2026-09-30.endive`. Local listener and cloud endpoint signing secrets are different. The payment return URL derives from the Worker's `AUTH_URL`, which must be the canonical dashboard origin.

Checkout creation requires a signed-in cookie and trusted Origin, accepts only a UUID `requestId`, and always selects the price on the server. Repeated requests reuse the same order/session. Orders belong to one user, including on the status endpoint. Verified webhooks retrieve canonical Stripe state, validate owner/amount/currency, and record the paid order, unique credit grant, and balance increase in an atomic D1 batch. Repeated or reordered events cannot downgrade a paid order or grant credits twice, including when status polling races a webhook. If you add fulfilment side effects, use a transactional outbox keyed by order ID rather than executing them repeatedly in a webhook. Creation is limited to ten requests per minute per user; status checks to sixty.

To clean up resources created by the setup helper:

```bash
pnpm stripe:cleanup .wrangler/stripe-demo-RUN-ID.json
```

It archives the demo price/product, removes its webhook, and clears matching local bindings. It leaves unrelated resources untouched. Stripe retains individual test payment/session history; use a dedicated sandbox and remove that sandbox when finished rather than clearing a shared account's test data. Cleanup is retryable using the retained manifest if interrupted. Normal automated tests below create **no Stripe account resources**.

## Easiest deployed setup

Add same-sandbox test secret and publishable keys to the ignored `apps/api/.dev.vars`, then run `pnpm cloud:up my-demo`. For a new environment it creates the product, price and webhook and installs their secrets automatically. It prints the dashboard URL. Do not run the local `stripe listen` flow for this deployed environment: its webhook already points at the deployed Worker.

Keep the ignored `.wrangler/sandboxes/my-demo/` directory. It records what the helper owns. `pnpm cloud:down my-demo` removes that environment and its owned Stripe webhook, and archives its owned product/price. This deletes the environment's D1/R2 data too. Do not run it on an environment you want to keep.

## What a passing payment check means

A fixture test proves the application's handling of signed events, retries and credit grants. A real sandbox check also proves that your keys match, the Payment Element loads, Stripe accepts the test card, the browser returns to the right dashboard, and the webhook reaches your Worker. Complete the [payment and metering checklist](verification.md#stripe-and-metered-requests) before calling the provider integration verified.

| Problem                          | Check                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Checkout is unavailable          | Test keys, active one-time price, and Worker secrets. Run `pnpm setup:doctor --online`.                     |
| Payment form will not load       | Network access to Stripe.js; matching sandbox secret/publishable keys; retry without a blocking extension.  |
| Checkout success says incomplete | The session exists but Stripe has not confirmed payment. A URL parameter cannot mark it paid.               |
| Order not found                  | Sign in as the buyer. The session ID must start with `cs_test_`.                                            |
| Webhook returns 400              | Use the signing secret for this endpoint. Local CLI listeners and deployed webhooks have different secrets. |
| Paid request returns 402         | Buy credits first; new users have zero credits.                                                             |
| Paid request returns 403         | Create a Summary key; a Todos key cannot spend credits.                                                     |
