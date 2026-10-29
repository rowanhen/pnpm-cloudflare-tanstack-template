import { Effect } from 'effect'
import type { GetConfigHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { publicConfiguration } from '../../runtime/configuration'
export const getConfig: GetConfigHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const { env } = yield* PublicApiRequest
		return { status: 200, body: publicConfiguration(env) }
	})
