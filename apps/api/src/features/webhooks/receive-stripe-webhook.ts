import { Effect } from 'effect'
import {
	receiveStripeWebhook as operation,
	type ReceiveStripeWebhookHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { CheckoutWebhook } from '../checkout/service'
import { checkoutWebhookLayer } from '../../runtime/checkout-layers'

export const receiveStripeWebhook: ReceiveStripeWebhookHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(CheckoutWebhook, (s) =>
				s.receive(input.body, input.headers['stripe-signature']),
			).pipe(Effect.provide(checkoutWebhookLayer(ctx.env))),
		)
		return { status: 200, body: value }
	})
