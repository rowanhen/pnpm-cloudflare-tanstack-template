import { Context, type Effect } from 'effect'
import type { SummaryData, SummaryInput } from '@workspace/contracts/values'
import type { ApplicationError } from '../../errors'
import type { StorageError } from '../../persistence'
import type { Charged } from '../billing/domain'
export class SummaryRepository extends Context.Service<
	SummaryRepository,
	{
		readonly decodeReplay: (value: string) => Effect.Effect<typeof SummaryData.Type, StorageError>
		readonly snapshot: (
			status: typeof SummaryInput.Type.status,
		) => Effect.Effect<{ total: number; completed: number }, StorageError>
	}
>()('metered/Repository') {}
export class SummaryService extends Context.Service<
	SummaryService,
	{
		readonly create: (
			keyId: string,
			idempotencyKey: string,
			input: typeof SummaryInput.Type,
		) => Effect.Effect<
			{ body: typeof SummaryData.Type; receipt: Charged },
			ApplicationError | StorageError
		>
	}
>()('metered/Service') {}
