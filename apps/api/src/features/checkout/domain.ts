import { Effect, Schema } from 'effect'
import { InvalidInput } from '../../errors'
import type { PaymentSession } from '../payments/service'
const fields = {
	id: Schema.String,
	user_id: Schema.String,
	request_id: Schema.String,
	amount: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	currency: Schema.String,
	credits: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
	price_id: Schema.String,
}
export const StoredOrder = Schema.Union([
	Schema.Struct({
		...fields,
		status: Schema.Literal('pending'),
		stripe_session_id: Schema.NullOr(Schema.String),
	}),
	Schema.Struct({
		...fields,
		status: Schema.Literals(['paid', 'expired', 'failed']),
		stripe_session_id: Schema.String,
	}),
])
export type StoredOrder = typeof StoredOrder.Type
export const reconciliationStatus = (order: StoredOrder, session: PaymentSession) => {
	if (
		session.livemode ||
		session.mode !== 'payment' ||
		session.metadata?.order_id !== order.id ||
		session.client_reference_id !== order.user_id ||
		session.amount_total !== order.amount ||
		session.currency !== order.currency ||
		(order.stripe_session_id !== null && order.stripe_session_id !== session.id)
	)
		return Effect.fail(new InvalidInput({ message: 'Checkout session does not match this order' }))
	return Effect.succeed(
		session.payment_status === 'paid' && session.status === 'complete'
			? ('paid' as const)
			: session.status === 'expired'
				? ('expired' as const)
				: ('pending' as const),
	)
}
