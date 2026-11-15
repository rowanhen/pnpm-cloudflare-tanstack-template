import { Effect } from 'effect'
import type { GetConfigHandler, GetHealthHandler } from '@workspace/contracts/operations'
import { PublicApiRequest, type ApiFailure } from '../../contract/context'
import { publicConfiguration } from '../../runtime/configuration'

export const getConfig: GetConfigHandler<PublicApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const { env } = yield* PublicApiRequest
		return { status: 200, body: publicConfiguration(env) }
	})

export const getHealth: GetHealthHandler<PublicApiRequest, ApiFailure> = () =>
	Effect.succeed({ status: 200, body: { ok: true } })
