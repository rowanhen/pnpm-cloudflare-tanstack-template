import type { AcceptedEmailData } from '@workspace/contracts/values'
import { Schema } from 'effect'
const id = Schema.String.check(Schema.isMinLength(1))
export const DeliveryState = Schema.Union([
	Schema.Struct({
		id,
		status: Schema.Literal('sending'),
		message_id: Schema.Null,
		error_code: Schema.Null,
	}),
	Schema.Struct({
		id,
		status: Schema.Literal('accepted'),
		message_id: id,
		error_code: Schema.Null,
	}),
	Schema.Struct({ id, status: Schema.Literal('failed'), message_id: Schema.Null, error_code: id }),
])
export type DeliveryState = typeof DeliveryState.Type
export type Mail = {
	readonly to: string
	readonly template: 'waitlist' | 'test'
	readonly dedupeKey: string
	readonly userId?: string
}
export type AcceptedMail = typeof AcceptedEmailData.Type
export type Settlement =
	| { readonly status: 'accepted'; readonly messageId: string }
	| { readonly status: 'failed'; readonly code: string }
