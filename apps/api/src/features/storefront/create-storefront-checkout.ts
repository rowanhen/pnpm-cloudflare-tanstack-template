import { Effect } from 'effect'
import {
	createStorefrontCheckout as operation,
	type CreateStorefrontCheckoutHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { storefront } from '../../runtime/storefront-resources'

export const createStorefrontCheckout: CreateStorefrontCheckoutHandler<PublicApiRequest> = (
	input,
) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			storefront(ctx.env).create(
				ctx.request.headers.get('cf-connecting-ip') ?? 'local',
				input.body,
			),
		)
		return { status: 200, body: value }
	})
