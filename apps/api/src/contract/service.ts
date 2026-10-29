import { Effect } from 'effect'
import { decodeResponse } from '@workspace/contracts/http'
import type { FailureOf, Operation } from '@workspace/contracts/operation'
import type { ApplicationError } from '../errors'
import type { StorageError } from '../persistence'
import { preserveFatal } from '../effect-errors'
import { rateLimitHeaders } from '../features/rate-limits/http'

export function failureResponse(error: ApplicationError): {
	status: number
	message: string
	headers?: Record<string, string>
} {
	switch (error._tag) {
		case 'InvalidInput':
			return { status: 400, message: error.message }
		case 'Unauthorized':
			return { status: 401, message: error.message }
		case 'Forbidden':
			return { status: 403, message: error.message }
		case 'MissingRecord':
			return { status: 404, message: error.message }
		case 'Conflict':
			return { status: 409, message: error.message }
		case 'Unavailable':
			return { status: 503, message: error.message }
		case 'ProviderFailure':
			return { status: 502, message: error.message }
		case 'InsufficientCredits':
			return {
				status: 402,
				message: 'Add credits to make this request',
				headers: {
					'X-Credits-Required': String(error.required),
					'X-Credits-Balance': String(error.balance),
				},
			}
		case 'RateLimited':
			return {
				status: 429,
				message: 'Too many requests. Please try again shortly.',
				headers: {
					...rateLimitHeaders({ limit: error.limit, remaining: 0, reset: error.reset }),
					'Retry-After': String(error.retryAfter),
				},
			}
	}
}
/** Only this transport boundary translates application failures into generated HTTP pairs. */
export const respond = <O extends Operation, A, R>(
	operation: O,
	program: Effect.Effect<A, ApplicationError | StorageError, R>,
) =>
	program.pipe(
		preserveFatal,
		Effect.catch((error): Effect.Effect<never, FailureOf<O>> => {
			if (error._tag === 'StorageError') return Effect.die(error)
			const response = failureResponse(error)
			if (!operation.errorCodes[response.status]) return Effect.die(error)
			const body = decodeResponse(
				operation,
				response.status,
				operation.emptyStatuses.includes(response.status)
					? undefined
					: { code: operation.errorCodes[response.status], error: response.message },
			)
			// Runtime schema validation above establishes the generated status/body correlation.
			return Effect.fail({
				status: response.status,
				body,
				headers: response.headers,
			} as FailureOf<O>)
		}),
	)
