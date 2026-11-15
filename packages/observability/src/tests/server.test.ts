import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { inspect } from 'node:util'
import { describe, test, vi } from 'vitest'
import { reportRequest } from '../server.ts'

describe('server telemetry', () => {
	test('when telemetry is flushed or its provider fails, errors remain sanitized', async () => {
		const requests: string[] = []
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: unknown, init?: RequestInit) => {
			requests.push(
				init?.body instanceof Uint8Array ? gunzipSync(init.body).toString() : String(init?.body),
			)
			return new Response('{}', { status: 200 })
		})
		const report = {
			requestId: crypto.randomUUID(),
			method: 'GET',
			path: '/api/files/private-name.pdf',
			status: 500,
			durationMs: 12.8,
			error: new Error('private@example.test sk_secret'),
		}
		await reportRequest({}, report)
		assert.equal(requests.length, 0)
		await reportRequest(
			{ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com', APP_ENV: 'test' },
			report,
		)
		const payload = requests.join('\n')
		assert.match(payload, /api.request/)
		assert.match(payload, /\$exception/)
		assert.match(payload, /api\/files\/:id/)
		assert.match(payload, /"status":500/)
		assert.match(payload, /"duration_ms":13/)
		assert.match(payload, /"\$process_person_profile":false/)
		assert.doesNotMatch(payload, /private-name|private@example|sk_secret/)
		const logs: string[] = []
		vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => logs.push(inspect(args)))
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new Error('provider secret')
		})
		await assert.doesNotReject(
			reportRequest({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com' }, report),
		)
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			async () => new Response('provider secret', { status: 400 }),
		)
		await assert.doesNotReject(
			reportRequest({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com' }, report),
		)
		assert.ok(logs.length > 0)
		assert.doesNotMatch(logs.join('\n'), /provider secret/)
	})
})
