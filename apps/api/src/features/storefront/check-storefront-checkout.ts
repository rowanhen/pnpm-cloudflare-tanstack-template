import { Effect } from 'effect'
import {
	checkStorefrontCheckout as operation,
	type CheckStorefrontCheckoutHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { storefront } from '../../runtime/storefront-resources'

export const checkStorefrontCheckout: CheckStorefrontCheckoutHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			storefront(ctx.env).check(ctx.request.headers.get('cf-connecting-ip') ?? 'local', input.body),
		)
		return { status: 200, body: value }
	})
