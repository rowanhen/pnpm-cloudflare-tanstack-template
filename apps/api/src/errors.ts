import { Data } from 'effect'
export class InvalidInput extends Data.TaggedError('InvalidInput')<{ readonly message: string }> {}
export class MissingRecord extends Data.TaggedError('MissingRecord')<{
	readonly message: string
}> {}
export class Conflict extends Data.TaggedError('Conflict')<{ readonly message: string }> {}
export class Forbidden extends Data.TaggedError('Forbidden')<{ readonly message: string }> {}
export class Unauthorized extends Data.TaggedError('Unauthorized')<{ readonly message: string }> {}
export class Unavailable extends Data.TaggedError('Unavailable')<{ readonly message: string }> {}
export class ProviderFailure extends Data.TaggedError('ProviderFailure')<{
	readonly message: string
	readonly cause: unknown
}> {}
export class RateLimited extends Data.TaggedError('RateLimited')<{
	readonly limit: number
	readonly reset: number
	readonly retryAfter: number
}> {}
export class InsufficientCredits extends Data.TaggedError('InsufficientCredits')<{
	readonly required: number
	readonly balance: number
}> {}
export type ApplicationError =
	| InvalidInput
	| MissingRecord
	| Conflict
	| Forbidden
	| Unauthorized
	| Unavailable
	| ProviderFailure
	| RateLimited
	| InsufficientCredits
