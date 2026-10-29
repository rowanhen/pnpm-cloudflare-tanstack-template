import { Context, type Effect } from 'effect'
import type { StorefrontCreateData, StorefrontCheckData } from '@workspace/contracts/values'
import type { ApplicationError } from '../../errors'
import type { StorageError } from '../../persistence'
export class StorefrontSettings extends Context.Service<
	StorefrontSettings,
	| { readonly enabled: false }
	| {
			readonly enabled: true
			readonly purchasePrice: string
			readonly subscriptionPrice: string
			readonly publishableKey: string
	  }
>()('storefront/Settings') {}
export type Product = {
	readonly id: 'purchase' | 'subscription'
	readonly name: string
	readonly amount: number
	readonly currency: string
	readonly interval: string | null
}
export type Catalogue =
	| { readonly enabled: false; readonly products: readonly [] }
	| { readonly enabled: true; readonly products: readonly Product[] }
export class StorefrontService extends Context.Service<
	StorefrontService,
	{
		readonly catalogue: (ip: string) => Effect.Effect<Catalogue, ApplicationError | StorageError>
		readonly create: (
			ip: string,
			input: typeof StorefrontCreateData.Type,
		) => Effect.Effect<
			{ sessionId: string; clientSecret: string; publishableKey: string },
			ApplicationError | StorageError
		>
		readonly check: (
			ip: string,
			input: typeof StorefrontCheckData.Type,
		) => Effect.Effect<
			{
				status: 'paid' | 'expired' | 'open' | 'pending'
				mode: 'payment' | 'subscription'
				amount: number
				currency: string
			},
			ApplicationError | StorageError
		>
	}
>()('storefront/Service') {}
