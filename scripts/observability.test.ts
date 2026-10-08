import { gunzipSync } from 'node:zlib'
import { inspect } from 'node:util'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeError, safePath, safeUrl } from '../packages/observability/src/privacy.ts'
import { reportRequest } from '../packages/observability/src/server.ts'
import { posthogBuildEnv } from './posthog-env.ts'

test('telemetry removes private paths, query values, exception messages and causes', () => {
	assert.equal(safePath('/api/files/medical-record.pdf'), '/api/files/:id')
	assert.equal(safePath('/api/checkout/sessions/cs_secret'), '/api/checkout/sessions/:id')
	assert.equal(safePath('/private@email.test'), '/:not-found')
	assert.equal(
		safeUrl('https://demo.test/checkout/success?session_id=cs_secret#token'),
		'https://demo.test/checkout/success',
	)
	const source = new TypeError('private@email.test', { cause: 'sk_secret' })
	source.stack =
		'TypeError: private@email.test\n    at fn (https://demo.test/assets/index.js:12:34)'
	const error = safeError(source)
	assert.equal(error.name, 'TypeError')
	assert.match(error.stack ?? '', /index.js:12:34/)
	assert.doesNotMatch(error.stack ?? '', /private@|sk_secret/)
	assert.equal(error.cause, undefined)
})

test('only a public collection token can reach frontend builds', () => {
	assert.throws(() =>
		posthogBuildEnv({
			POSTHOG_KEY: 'phx_personal_secret',
			POSTHOG_HOST: 'https://eu.i.posthog.com',
		}),
	)
	assert.throws(() => posthogBuildEnv({ POSTHOG_KEY: 'phc_test' }))
	assert.deepEqual(
		posthogBuildEnv({
			POSTHOG_KEY: 'phc_test',
			POSTHOG_HOST: 'https://eu.i.posthog.com',
			POSTHOG_PERSONAL_API_KEY: 'phx_secret',
		}),
		{
			VITE_POSTHOG_KEY: 'phc_test',
			VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
			VITE_APP_ENV: 'development',
		},
	)
})

test('server SDK flushes operational events and sanitized exceptions, tolerating outages', async (t) => {
	const requests: string[] = []
	t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
		requests.push(
			init.body instanceof Uint8Array ? gunzipSync(init.body).toString() : String(init.body),
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
	t.mock.method(console, 'error', (...args: unknown[]) => logs.push(inspect(args)))
	t.mock.method(globalThis, 'fetch', async () => {
		throw new Error('provider secret')
	})
	await assert.doesNotReject(
		reportRequest({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com' }, report),
	)
	t.mock.method(globalThis, 'fetch', async () => new Response('provider secret', { status: 400 }))
	await assert.doesNotReject(
		reportRequest({ POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com' }, report),
	)
	assert.ok(logs.length > 0)
	assert.doesNotMatch(logs.join('\n'), /provider secret/)
})
