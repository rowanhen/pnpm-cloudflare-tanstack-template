import { Context, type Effect } from 'effect'
import type { CheckoutConfig, CheckoutSession, OrderStatus } from '@workspace/contracts'
import type { CheckoutInput } from '@workspace/contracts/values'
import type { ApplicationError } from '../../errors'
import type { StorageError } from '../../persistence'
import type { StoredOrder } from './domain'
export class CheckoutSettings extends Context.Service<
	CheckoutSettings,
	| { readonly enabled: false }
	| { readonly enabled: true; readonly priceId: string; readonly publishableKey: string }
>()('checkout/Settings') {}
export class CheckoutActor extends Context.Service<
	CheckoutActor,
	{ readonly userId: string; readonly email: string }
>()('checkout/Actor') {}
export class CheckoutRepository extends Context.Service<
	CheckoutRepository,
	{
		readonly reserve: (
			userId: string,
			requestId: string,
			offer: { amount: number; currency: string; credits: number; priceId: string },
		) => Effect.Effect<StoredOrder, StorageError>
		readonly find: (id: string) => Effect.Effect<StoredOrder | undefined, StorageError>
		readonly findOwned: (
			sessionId: string,
			userId: string,
		) => Effect.Effect<StoredOrder | undefined, StorageError>
		readonly reconcile: (
			order: StoredOrder,
			sessionId: string,
			status: 'pending' | 'paid' | 'expired',
			eventId?: string,
		) => Effect.Effect<void, StorageError>
		readonly received: (id: string) => Effect.Effect<boolean, StorageError>
	}
>()('checkout/Repository') {}
export class CheckoutService extends Context.Service<
	CheckoutService,
	{
		readonly config: Effect.Effect<CheckoutConfig, ApplicationError | StorageError>
		readonly create: (
			input: typeof CheckoutInput.Type,
		) => Effect.Effect<CheckoutSession, ApplicationError | StorageError>
		readonly get: (sessionId: string) => Effect.Effect<OrderStatus, ApplicationError | StorageError>
	}
>()('checkout/Service') {}
export class CheckoutWebhook extends Context.Service<
	CheckoutWebhook,
	{
		readonly receive: (
			raw: string,
			signature: string,
		) => Effect.Effect<{ received: boolean }, ApplicationError | StorageError>
	}
>()('checkout/Webhook') {}
