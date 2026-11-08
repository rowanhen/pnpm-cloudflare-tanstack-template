import { Effect } from 'effect'
import type { KeyScope } from '@workspace/contracts'
import { rateLimitHeaders } from '../features/rate-limits/http'
import { keyAuthentication } from '../runtime/key-resources'
import { preserveFatal } from '../effect-errors'
import { HttpError } from '../http'
import type { Env } from '../env'
import { failureResponse } from './service'
export async function apiKeyUser(request: Request, env: Env, scope: KeyScope) {
	const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? ''
	const identity = await Effect.runPromise(
		keyAuthentication(env)
			.authenticate(token, scope)
			.pipe(
				preserveFatal,
				Effect.catch((error) => {
					if (error._tag === 'StorageError') return Effect.die(error)
					const response = failureResponse(error)
					return Effect.die(new HttpError(response.status, response.message, response.headers))
				}),
			),
		{ signal: request.signal },
	)
	return {
		userId: identity.userId,
		keyId: identity.keyId,
		headers: rateLimitHeaders(identity.quota),
	}
}
