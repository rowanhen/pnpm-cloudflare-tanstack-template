import type { Effect, Schema } from 'effect'

export interface Operation {
	readonly operationId: string
	readonly method: string
	readonly path: string
	readonly hasBody: boolean
	readonly input: Schema.Codec<unknown>
	readonly responses: Readonly<Record<number, Schema.Codec<unknown>>>
	readonly errorCodes: Readonly<Record<number, string>>
}

export type InputOf<O extends Operation> = O['input']['Type']
export type ResponseOf<O extends Operation> = {
	[S in keyof O['responses'] & number]: {
		readonly status: S
		readonly body: Schema.Schema.Type<O['responses'][S]>
	}
}[keyof O['responses'] & number]
type SuccessResponse<R> = R extends { status: infer S extends number }
	? `${S}` extends `2${string}`
		? R
		: never
	: never
export type SuccessOf<O extends Operation> = SuccessResponse<ResponseOf<O>>
export type FailureOf<O extends Operation> = Exclude<ResponseOf<O>, SuccessOf<O>>
export type Handler<O extends Operation, R = never> = (
	input: InputOf<O>,
) => Effect.Effect<SuccessOf<O>, FailureOf<O>, R>
