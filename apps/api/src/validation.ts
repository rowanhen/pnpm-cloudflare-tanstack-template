import { Effect, Schema } from 'effect'
import { InvalidInput } from './errors'
export const validate = <A>(schema: Schema.Codec<A, unknown>, value: unknown) =>
	Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(value).pipe(
		Effect.mapError(() => new InvalidInput({ message: 'Invalid input' })),
	)
