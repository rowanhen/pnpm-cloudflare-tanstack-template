import { Context, type Effect } from 'effect'
export class IdentityCrypto extends Context.Service<
	IdentityCrypto,
	{
		readonly hash: (value: string) => Effect.Effect<string>
		readonly token: Effect.Effect<string>
	}
>()('identity/Crypto') {}
