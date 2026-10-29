import { Effect } from 'effect'
import {
	receiveStripeWebhook as operation,
	type ReceiveStripeWebhookHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { stripeWebhook } from '../checkout/stripe'
export const receiveStripeWebhook: ReceiveStripeWebhookHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* PublicApiRequest
		const body = yield* attempt(operation, () =>
			stripeWebhook(input.body, input.headers['stripe-signature'], context.env),
		)
		return { status: 200, body }
	})
