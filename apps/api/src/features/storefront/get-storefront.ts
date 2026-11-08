import { Effect } from 'effect'
import {
	getStorefront as operation,
	type GetStorefrontHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { storefront } from '../../runtime/storefront-resources'

export const getStorefront: GetStorefrontHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			storefront(ctx.env).catalogue(ctx.request.headers.get('cf-connecting-ip') ?? 'local'),
		)
		return { status: 200, body: value }
	})
