import { Context, type Effect } from 'effect'
import type { StorageError } from '../../persistence'
import type { RateLimited } from '../../errors'
export type Quota = { readonly limit: number; readonly remaining: number; readonly reset: number }
export class RateLimitRepository extends Context.Service<
	RateLimitRepository,
	{
		readonly acquire: (
			key: string,
			limit: number,
			window: number,
		) => Effect.Effect<number | undefined, StorageError>
	}
>()('rate-limits/Repository') {}
export class RateLimiter extends Context.Service<
	RateLimiter,
	{
		readonly check: (
			key: string,
			limit: number,
			seconds?: number,
		) => Effect.Effect<Quota, StorageError | RateLimited>
	}
>()('rate-limits/Service') {}
