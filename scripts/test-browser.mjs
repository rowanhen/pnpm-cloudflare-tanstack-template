import { spawn } from 'node:child_process'
import { localWorker } from './local-worker.mjs'
let worker
try {
	if (!process.env.E2E_API_URL) worker = await localWorker(8787)
	const env = worker
		? {
				...process.env,
				E2E_API_URL: worker.base,
				E2E_PROXY_SECRET: worker.proxySecret,
				E2E_COOKIE_ALICE: worker.fixture.cookies[0],
				E2E_COOKIE_BOB: worker.fixture.cookies[1],
			}
		: process.env
	const child = spawn('pnpm', ['exec', 'playwright', 'test'], { stdio: 'inherit', env })
	for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
	const code = await new Promise((resolve, reject) => {
		child.on('error', reject)
		child.on('exit', (exitCode) => resolve(exitCode ?? 1))
	})
	process.exitCode = code
} finally {
	await worker?.stop()
}
