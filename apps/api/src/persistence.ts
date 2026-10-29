import { Data, Effect, Schema } from 'effect'

export class StorageError extends Data.TaggedError('StorageError')<{
	readonly cause: unknown
}> {}

/** Finish D1 statements before interruption can leave their outcome unobserved. */
export const storageEffect = <A>(query: () => PromiseLike<A>) =>
	Effect.tryPromise({ try: query, catch: (cause) => new StorageError({ cause }) }).pipe(
		// D1 cannot abort a statement. Await its result so a late write cannot
		// race interruption cleanup.
		Effect.uninterruptible,
	)

export const decodeStored = <A>(schema: Schema.Codec<A, unknown>, value: unknown) =>
	Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(value).pipe(
		Effect.mapError((cause) => new StorageError({ cause })),
	)
