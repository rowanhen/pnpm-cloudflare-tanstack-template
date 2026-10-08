import assert from 'node:assert/strict'
import type { LocalWorker } from './local-worker.ts'

export async function testObservability(worker: LocalWorker) {
	const success = await fetch(`${worker.base}/api/config`, {
		headers: { 'x-test-observability': 'true' },
	})
	assert.equal(success.status, 200)
	const failure = await fetch(`${worker.base}/api/files/private-filename.pdf?token=private-query`, {
		headers: { 'x-test-observability': 'error', cookie: worker.fixture.cookies[1] },
	})
	assert.equal(failure.status, 500)
	const requestId = failure.headers.get('x-request-id')
	assert.ok(requestId)
	let payload = ''
	for (let attempt = 0; attempt < 50; attempt++) {
		payload = JSON.stringify(worker.telemetry.batches)
		if (payload.includes('$exception')) break
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	assert.match(payload, /api.request/)
	assert.match(payload, /\$exception/)
	assert.ok(payload.includes(requestId))
	assert.match(payload, /api\/files\/:id/)
	assert.doesNotMatch(payload, /private-filename|private-query|private-exception|example.test/)
	console.log(
		'Worker telemetry flushed through waitUntil; success/error status, request correlation and redaction passed.',
	)
}
