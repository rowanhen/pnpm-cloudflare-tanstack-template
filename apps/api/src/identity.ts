import type { Effect } from 'effect'
export type IdentityCrypto = {
	readonly hash: (value: string) => Effect.Effect<string>
	readonly token: Effect.Effect<string>
}
