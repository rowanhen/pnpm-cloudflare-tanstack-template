import type { Env } from '../env'
import { identityCrypto } from '../identity-crypto'
import { makeSummary } from '../features/metered/metered'
import { summaryRepository } from '../features/metered/repository'
import { userBilling } from './billing-resources'
export const userSummary = (env: Env, userId: string) =>
	makeSummary({
		repository: summaryRepository(env.DB, userId),
		billing: userBilling(env, userId),
		crypto: identityCrypto,
	})
