import { Effect } from 'effect'
import {
	receiveStripeWebhook as operation,
	type ReceiveStripeWebhookHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { checkoutWebhook } from '../../runtime/checkout-resources'

export const receiveStripeWebhook: ReceiveStripeWebhookHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			checkoutWebhook(ctx.env).receive(input.body, input.headers['stripe-signature']),
		)
		return { status: 200, body: value }
	})
