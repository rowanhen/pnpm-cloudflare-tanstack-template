// Loaded only by the setup tests; the production CLI has no transport override.
import { z } from 'zod'
const origin = z.url().parse(process.env.TEST_STRIPE_ORIGIN)
if (new URL(origin).hostname !== '127.0.0.1') throw new Error('Expected a local Stripe fixture')
const original = globalThis.fetch
globalThis.fetch = (input, init) => {
	const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
	if (url.hostname !== 'api.stripe.com') throw new Error('Unexpected network host')
	return original(origin + url.pathname + url.search, init)
}
