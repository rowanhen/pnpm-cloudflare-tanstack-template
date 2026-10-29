import { Schema } from 'effect'
export const CREDIT_PACK = 1_000
export const SUMMARY_COST = 1
export const Receipt = Schema.Struct({
	id: Schema.String,
	operation: Schema.String,
	input_hash: Schema.String,
	credits: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	response: Schema.String,
})
export type Receipt = typeof Receipt.Type
export type Charge = {
	readonly keyId: string
	readonly idempotencyKey: string
	readonly operation: string
	readonly inputHash: string
	readonly cost: number
	readonly result: string
}
export type Charged = {
	readonly response: string
	readonly requestId: string
	readonly charged: number
	readonly balance: number
	readonly replayed: boolean
}
