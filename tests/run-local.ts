import { testMeteredValidation } from './integration/metered-validation.ts'
import { testTodoStorage } from './integration/todo-storage.ts'
import { testStorefront } from './integration/storefront.ts'
import { testObservability } from './integration/observability.ts'
import { testEmail } from './integration/email.ts'
import { localWorker } from './support/local-worker.ts'
import { testApi } from './integration/api.ts'
import { testMetering } from './integration/metering.ts'
import { testCheckout } from './integration/checkout.ts'
const worker = await localWorker(process.env.TEST_API_PORT ?? 8799)
for (const signal of ['SIGINT', 'SIGTERM'])
	process.once(signal, () => {
		void worker.stop().finally(() => process.exit(1))
	})
try {
	await testApi(worker.base, worker.fixture.cookies, worker.proxySecret)
	await testTodoStorage(worker)
	await testMetering(worker.base, worker.fixture.cookies)
	await testCheckout(worker)
	await testStorefront(worker)
	await testEmail(worker)
	await testMeteredValidation(worker)
	await testObservability(worker)
} finally {
	await worker.stop()
	console.log('Local Worker and isolated D1/R2 test storage removed.')
}
