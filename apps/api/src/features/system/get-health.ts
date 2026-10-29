import { Effect } from 'effect'
import { type GetHealthHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'

export const getHealth: GetHealthHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* PublicApiRequest
		return {
			status: 200,
			body: {
				ok: true,
				...(context.env.DATABASE_MAINTENANCE === 'true' ? { maintenance: true } : {}),
			},
		}
	})
