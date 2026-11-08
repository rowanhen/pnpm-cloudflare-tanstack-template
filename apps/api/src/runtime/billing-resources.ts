import type { Env } from '../env'
import { makeBilling } from '../features/billing/billing'
import { billingRepository } from '../features/billing/repository'
export const userBilling = (env: Pick<Env, 'DB'>, userId: string) =>
	makeBilling({ repository: billingRepository(env.DB, userId) })
