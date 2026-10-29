import { Effect } from 'effect'
import {
	checkStorefrontCheckout as operation,
	type CheckStorefrontCheckoutHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { StorefrontService } from './service'
import { storefrontLayer } from '../../runtime/storefront-layers'

export const checkStorefrontCheckout: CheckStorefrontCheckoutHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(StorefrontService, (s) =>
				s.check(ctx.request.headers.get('cf-connecting-ip') ?? 'local', input.body),
			).pipe(Effect.provide(storefrontLayer(ctx.env))),
		)
		return { status: 200, body: value }
	})
