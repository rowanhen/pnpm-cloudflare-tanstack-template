import { localWorker } from './local-worker.mjs'
import { testApi } from './test-api.mjs'
import { testMetering } from './test-metering.mjs'
import { testCheckout } from './test-checkout.mjs'
const worker = await localWorker(process.env.TEST_API_PORT ?? 8799)
for (const signal of ['SIGINT', 'SIGTERM'])
	process.once(signal, () => {
		void worker.stop().finally(() => process.exit(1))
	})
try {
	await testApi(worker.base, worker.fixture.cookies, worker.proxySecret)
	await testMetering(worker.base, worker.fixture.cookies)
	await testCheckout(worker)
} finally {
	await worker.stop()
	console.log('Local Worker and isolated D1/R2 test storage removed.')
}
