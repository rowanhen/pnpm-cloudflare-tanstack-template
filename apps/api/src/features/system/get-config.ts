import { Effect } from 'effect'
import { type GetConfigHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { emailEnabled } from '../../email'
import { checkoutEnabled } from '../../checkout'
export const getConfig: GetConfigHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* PublicApiRequest
		return {
			status: 200,
			body: {
				emailEnabled: emailEnabled(context.env),
				checkoutEnabled: checkoutEnabled(context.env),
				googleEnabled: Boolean(context.env.GOOGLE_CLIENT_ID && context.env.GOOGLE_CLIENT_SECRET),
			},
		}
	})
