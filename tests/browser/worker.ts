import { localWorker } from '../support/local-worker.ts'

const worker = await localWorker(8798, {
	marketing: 'http://localhost:3100',
	dashboard: 'http://localhost:3101',
})
for (const signal of ['SIGINT', 'SIGTERM'] as const)
	process.on(signal, () => {
		void worker.stop().then(() => process.exit(0))
	})
