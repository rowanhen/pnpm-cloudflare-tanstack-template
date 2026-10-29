import { Effect } from 'effect'
import {
	getStorefront as operation,
	type GetStorefrontHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { StorefrontService } from './service'
import { storefrontLayer } from '../../runtime/storefront-layers'

export const getStorefront: GetStorefrontHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(StorefrontService, (s) =>
				s.catalogue(ctx.request.headers.get('cf-connecting-ip') ?? 'local'),
			).pipe(Effect.provide(storefrontLayer(ctx.env))),
		)
		return { status: 200, body: value }
	})
