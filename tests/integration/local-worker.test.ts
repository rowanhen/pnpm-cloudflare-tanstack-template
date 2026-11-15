import { afterAll, beforeAll, describe, test } from 'vitest'
import { testMeteredValidation } from './metered-validation.ts'
import { testTodoStorage } from './todo-storage.ts'
import { testStorefront } from './storefront.ts'
import { testObservability } from './observability.ts'
import { testEmail } from './email.ts'
import { localWorker, type LocalWorker } from '../support/local-worker.ts'
import { testApi } from './api.ts'
import { testMetering } from './metering.ts'
import { testCheckout } from './checkout.ts'

describe('local Worker integration', () => {
	let worker: LocalWorker
	beforeAll(async () => {
		worker = await localWorker(process.env.TEST_API_PORT ?? 8799)
	})
	afterAll(async () => {
		await worker.stop()
	})

	test('when API requests cross the Worker boundary, auth and storage rules hold', async () => {
		await testApi(worker.base, worker.fixture.cookies, worker.proxySecret)
	})
	test('when stored todos violate invariants, errors stay isolated', async () => {
		await testTodoStorage(worker)
	})
	test('when metered requests repeat, billing and rate limits remain consistent', async () => {
		await testMetering(worker.base, worker.fixture.cookies)
	})
	test('when checkout events repeat, payment and credit effects remain consistent', async () => {
		await testCheckout(worker)
	})
	test('when storefront requests cross the Worker boundary, checkout proof remains valid', async () => {
		await testStorefront(worker)
	})
	test('when email requests repeat or fail, delivery state remains safe', async () => {
		await testEmail(worker)
	})
	test('when metered snapshots are invalid, no debit is saved', async () => {
		await testMeteredValidation(worker)
	})
	test('when Worker requests emit telemetry, private data stays redacted', async () => {
		await testObservability(worker)
	})
})
