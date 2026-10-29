import { Context, Schema, type Effect } from 'effect'
import type { InvalidInput, Unavailable, ProviderFailure } from '../../errors'
export const PaymentSession = Schema.Struct({
	id: Schema.String.check(Schema.isMinLength(1)),
	livemode: Schema.Boolean,
	mode: Schema.Literals(['payment', 'subscription', 'setup']),
	status: Schema.NullOr(Schema.Literals(['open', 'complete', 'expired'])),
	payment_status: Schema.Literals(['paid', 'unpaid', 'no_payment_required']),
	client_reference_id: Schema.NullOr(Schema.String),
	client_secret: Schema.NullOr(Schema.String),
	amount_total: Schema.NullOr(
		Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
	),
	currency: Schema.NullOr(Schema.String.check(Schema.isMinLength(1))),
	metadata: Schema.NullOr(Schema.Record(Schema.String, Schema.String)),
})
export type PaymentSession = typeof PaymentSession.Type
export type Offer = {
	readonly priceId: string
	readonly name: string
	readonly description: string | null
	readonly amount: number
	readonly currency: string
	readonly interval: string | null
}
export type CheckoutIntent =
	| {
			readonly kind: 'credits'
			readonly priceId: string
			readonly orderId: string
			readonly userId: string
			readonly email: string
	  }
	| {
			readonly kind: 'storefront'
			readonly priceId: string
			readonly product: 'purchase' | 'subscription'
			readonly tokenHash: string
			readonly requestId: string
	  }
export type PaymentEvent =
	| { readonly kind: 'ignored' }
	| { readonly kind: 'checkout'; readonly eventId: string; readonly sessionId: string }
export class PaymentGateway extends Context.Service<
	PaymentGateway,
	{
		readonly price: (
			id: string,
			kind: 'one_time' | 'recurring',
		) => Effect.Effect<Offer, Unavailable | ProviderFailure>
		readonly session: (id: string) => Effect.Effect<PaymentSession, Unavailable | ProviderFailure>
		readonly create: (
			intent: CheckoutIntent,
		) => Effect.Effect<PaymentSession, Unavailable | ProviderFailure>
		readonly verify: (
			raw: string,
			signature: string,
		) => Effect.Effect<PaymentEvent, InvalidInput | Unavailable | ProviderFailure>
	}
>()('payments/Gateway') {}
