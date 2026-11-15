import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect, Exit } from 'effect'
import { makeSummary } from '../metered.ts'
import { SummaryResult } from '../domain.ts'
import type { IdentityCrypto } from '../../../identity.ts'
import { StorageError, decodeStored } from '../../../persistence.ts'
const identity: IdentityCrypto = {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
}
const requestId = '00000000-0000-4000-8000-000000000001'

describe('metered', () => {
	test('when a summary snapshot is invalid, billing is not called', async () => {
		let charges = 0
		const service = makeSummary({
			crypto: identity,
			repository: {
				snapshot: () => Effect.succeed({ total: 1, completed: 2 }),
				decodeReplay: () => Effect.die('must not replay'),
			},
			billing: {
				charge: () =>
					Effect.sync(() => {
						charges++
						return {
							response: '{}',
							requestId: 'receipt',
							charged: 1,
							balance: 2,
							replayed: false,
						}
					}),
			},
		})
		const exit = await Effect.runPromiseExit(service.create('key', requestId, { status: 'all' }))
		assert.ok(Exit.isFailure(exit))
		assert.equal(charges, 0)
		const corrupt = await Effect.runPromise(
			decodeStored(SummaryResult, {
				summary: { total: 2, completed: 1, open: 2 },
				status: 'all',
			}).pipe(Effect.flip),
		)
		assert.ok(corrupt instanceof StorageError)
	})
})
