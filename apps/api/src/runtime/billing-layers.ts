import { Layer } from 'effect'
import type { Env } from '../env'
import { BillingLive } from '../features/billing/live'
import { billingRepositoryLayer } from '../features/billing/repository'
export const billingLayer = (env: Pick<Env, 'BILLING_DB'>, userId: string) =>
	BillingLive.pipe(Layer.provide(billingRepositoryLayer(env.BILLING_DB, userId)))
