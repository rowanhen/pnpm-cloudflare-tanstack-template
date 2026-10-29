import { Context, type Effect } from 'effect'
import type { Key, KeyScope } from '@workspace/contracts'
import type { CreateKeyData, NewKeyData } from '@workspace/contracts/values'
import type { ApplicationError } from '../../errors'
import type { StorageError } from '../../persistence'
import type { Quota } from '../rate-limits/service'
export const MAX_KEYS = 10
export type NewKey = typeof NewKeyData.Type
export class KeyRepository extends Context.Service<
	KeyRepository,
	{
		readonly list: Effect.Effect<readonly Key[], StorageError>
		readonly create: (
			name: string,
			scope: KeyScope,
			hash: string,
			prefix: string,
		) => Effect.Effect<string | undefined, StorageError>
		readonly remove: (id: string) => Effect.Effect<boolean, StorageError>
	}
>()('keys/Repository') {}
export class KeyAuthenticationRepository extends Context.Service<
	KeyAuthenticationRepository,
	{
		readonly find: (
			hash: string,
		) => Effect.Effect<{ id: string; userId: string; scope: KeyScope } | undefined, StorageError>
		readonly touch: (id: string, millis: number) => Effect.Effect<void, StorageError>
	}
>()('keys/AuthenticationRepository') {}
export class KeyService extends Context.Service<
	KeyService,
	{
		readonly list: Effect.Effect<readonly Key[], StorageError>
		readonly create: (
			input: typeof CreateKeyData.Type,
		) => Effect.Effect<NewKey, ApplicationError | StorageError>
		readonly remove: (id: string) => Effect.Effect<void, ApplicationError | StorageError>
	}
>()('keys/Service') {}
export class KeyAuthentication extends Context.Service<
	KeyAuthentication,
	{
		readonly authenticate: (
			token: string,
			scope: KeyScope,
		) => Effect.Effect<
			{ userId: string; keyId: string; quota: Quota },
			ApplicationError | StorageError
		>
	}
>()('keys/Authentication') {}
export class KeyOwner extends Context.Service<KeyOwner, { readonly userId: string }>()(
	'keys/Owner',
) {}
