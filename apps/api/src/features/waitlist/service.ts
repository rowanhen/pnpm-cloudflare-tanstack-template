import { Context, type Effect } from 'effect'
import type { WaitlistInput } from '@workspace/contracts/values'
import type { User } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import type { ApplicationError } from '../../errors'
export type WaitlistStatus =
	| { readonly joined: false; readonly entry: null }
	| { readonly joined: true; readonly entry: { readonly created_at: string } }
export class WaitlistRepository extends Context.Service<
	WaitlistRepository,
	{
		readonly join: (entry: {
			email: string
			name: string
			consent: true
		}) => Effect.Effect<string | undefined, StorageError>
		readonly find: (
			email: string,
		) => Effect.Effect<{ created_at: string } | undefined, StorageError>
	}
>()('waitlist/Repository') {}
export class WaitlistService extends Context.Service<
	WaitlistService,
	{
		readonly join: (
			input: typeof WaitlistInput.Type,
			ip: string,
		) => Effect.Effect<{ message: string }, ApplicationError | StorageError>
		readonly status: (user: User) => Effect.Effect<WaitlistStatus, StorageError>
	}
>()('waitlist/Service') {}
