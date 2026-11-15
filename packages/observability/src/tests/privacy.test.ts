import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { safeError, safePath, safeUrl } from '../privacy.ts'

describe('telemetry privacy', () => {
	test('when telemetry is captured, private data is removed', () => {
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
})
