import { Context, type Effect } from 'effect'
import type { BillingStatus } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import type { Conflict, InsufficientCredits } from '../../errors'
import type { Charge, Charged, Receipt } from './domain'
export class BillingRepository extends Context.Service<
	BillingRepository,
	{
		readonly reserve: (
			charge: Charge,
		) => Effect.Effect<
			{ receipt: Receipt | undefined; balance: number; attemptId: string },
			StorageError
		>
		readonly status: Effect.Effect<BillingStatus, StorageError>
	}
>()('billing/Repository') {}
export class BillingLedger extends Context.Service<
	BillingLedger,
	{
		readonly charge: (
			charge: Charge,
		) => Effect.Effect<Charged, StorageError | Conflict | InsufficientCredits>
		readonly status: Effect.Effect<BillingStatus, StorageError>
	}
>()('billing/Ledger') {}
