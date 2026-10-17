import { Effect } from 'effect'
import type { CreateStorefrontCheckoutHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { HttpError, sha256 } from '../../http'
import { attempt, product, provider, limit } from './service'
export const createStorefrontCheckout: CreateStorefrontCheckoutHandler<PublicApiRequest> = ({
	body,
}) =>
	Effect.gen(function* () {
		const { env, request } = yield* PublicApiRequest
		const checkout = yield* attempt(async () => {
			await limit(env, request, 'create', 10)
			const stripe = provider(env)
			const offer = await product(env, body.product, stripe)
			const tokenHash = await sha256(body.token)
			const session = await stripe.checkout.sessions.create(
				{
					ui_mode: 'hosted_page',
					mode: body.product === 'subscription' ? 'subscription' : 'payment',
					allowed_payment_method_types: ['card'],
					adaptive_pricing: { enabled: false },
					line_items: [{ price: offer.priceId, quantity: 1 }],
					metadata: { example: 'storefront', guest_token_hash: tokenHash },
					...(body.product === 'subscription'
						? { subscription_data: { metadata: { example: 'storefront' } } }
						: {}),
					success_url: `${env.AUTH_URL}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
					cancel_url: `${env.AUTH_URL}/checkout?cancelled=true`,
				},
				{ idempotencyKey: `storefront-${tokenHash}-${body.requestId}-${body.product}` },
			)
			if (
				session.livemode ||
				!session.url ||
				new URL(session.url).origin !== 'https://checkout.stripe.com'
			)
				throw new HttpError(503, 'Unable to open test checkout')
			return { sessionId: session.id, url: session.url }
		})
		return { status: 200, body: checkout }
	})
