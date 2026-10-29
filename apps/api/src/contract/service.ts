import { Effect } from 'effect'
import { decodeResponse } from '@workspace/contracts/http'
import type { FailureOf, Operation } from '@workspace/contracts/operation'
import { HttpError } from '../http'

/** Adapt expected service failures using the operation's generated response schemas. */
export const attempt = <O extends Operation, A>(operation: O, run: () => Promise<A>) =>
	Effect.tryPromise({ try: run, catch: (error) => error }).pipe(
		Effect.catch((error): Effect.Effect<never, FailureOf<O>> => {
			if (!(error instanceof HttpError)) return Effect.die(error)
			if (error.status < 400 || !operation.errorCodes[error.status]) return Effect.die(error)
			const body = decodeResponse(
				operation,
				error.status,
				operation.emptyStatuses.includes(error.status)
					? undefined
					: { code: operation.errorCodes[error.status], error: error.message },
			)
			// The generated operation validated this status/body pair before it enters the failure channel.
			return Effect.fail({ status: error.status, body, headers: error.headers } as FailureOf<O>)
		}),
	)
