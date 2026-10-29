import { Effect } from 'effect'
import type { CheckStorefrontCheckoutHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { HttpError } from '../../http'
import { sha256 } from '../../identity-hash'
import { attempt, provider, limit } from './stripe'
export const checkStorefrontCheckout: CheckStorefrontCheckoutHandler<PublicApiRequest> = ({
	body,
}) =>
	Effect.gen(function* () {
		const { env, request } = yield* PublicApiRequest
		const status = yield* attempt(async () => {
			await limit(env, request, 'status', 60)
			const session = await provider(env).checkout.sessions.retrieve(body.sessionId)
			if (
				session.livemode ||
				session.metadata?.example !== 'storefront' ||
				session.metadata?.guest_token_hash !== (await sha256(body.token)) ||
				(session.mode !== 'payment' && session.mode !== 'subscription')
			)
				throw new HttpError(404, 'Checkout not found')
			return {
				status:
					session.status === 'complete' && session.payment_status === 'paid'
						? ('paid' as const)
						: session.status === 'expired'
							? ('expired' as const)
							: session.status === 'open'
								? ('open' as const)
								: ('pending' as const),
				mode: session.mode === 'subscription' ? ('subscription' as const) : ('payment' as const),
				amount: session.amount_total ?? 0,
				currency: session.currency ?? 'gbp',
			}
		})
		return { status: 200, body: status }
	})
