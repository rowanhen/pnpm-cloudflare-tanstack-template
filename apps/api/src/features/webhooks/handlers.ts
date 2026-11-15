import { Effect } from 'effect'
import type { ReceiveStripeWebhookHandler } from '@workspace/contracts/operations'
import { PublicApiRequest, type ApiFailure } from '../../contract/context'
import { checkoutWebhook } from '../../runtime/checkout-resources'

export const receiveStripeWebhook: ReceiveStripeWebhookHandler<PublicApiRequest, ApiFailure> = (
	input,
) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* checkoutWebhook(ctx.env).receive(
			input.body,
			input.headers['stripe-signature'],
		)
		return { status: 200, body: value }
	})
