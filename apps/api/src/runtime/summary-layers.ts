import { Layer } from 'effect'
import type { Env } from '../env'
import { IdentityCryptoLive } from '../identity-crypto'
import { SummaryLive } from '../features/metered/live'
import { summaryRepositoryLayer } from '../features/metered/repository'
import { billingLayer } from './billing-layers'
export const summaryLayer = (env: Env, userId: string) =>
	SummaryLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				summaryRepositoryLayer(env.PRODUCT_DB, userId),
				billingLayer(env, userId),
				IdentityCryptoLive,
			),
		),
	)
