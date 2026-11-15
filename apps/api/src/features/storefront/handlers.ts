import { Effect } from 'effect'
import type {
	CheckStorefrontCheckoutHandler,
	CreateStorefrontCheckoutHandler,
	GetStorefrontHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest, type ApiFailure } from '../../contract/context'
import { storefront } from '../../runtime/storefront-resources'

export const checkStorefrontCheckout: CheckStorefrontCheckoutHandler<
	PublicApiRequest,
	ApiFailure
> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* storefront(ctx.env).check(
			ctx.request.headers.get('cf-connecting-ip') ?? 'local',
			input.body,
		)
		return { status: 200, body: value }
	})

export const createStorefrontCheckout: CreateStorefrontCheckoutHandler<
	PublicApiRequest,
	ApiFailure
> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* storefront(ctx.env).create(
			ctx.request.headers.get('cf-connecting-ip') ?? 'local',
			input.body,
		)
		return { status: 200, body: value }
	})

export const getStorefront: GetStorefrontHandler<PublicApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* storefront(ctx.env).catalogue(
			ctx.request.headers.get('cf-connecting-ip') ?? 'local',
		)
		return { status: 200, body: value }
	})
