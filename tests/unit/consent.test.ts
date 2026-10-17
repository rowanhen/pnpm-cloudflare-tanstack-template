import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	createConsent,
	parseConsent,
	consentLifetime,
} from '../../packages/observability/src/consent.ts'

const now = Date.UTC(2026, 9, 17)
test('consent keeps independent purposes, policy version, source and bounded dates', () => {
	const record = createConsent({ analytics: true, replay: false }, now)
	assert.deepEqual(parseConsent(JSON.stringify(record), now), {
		analytics: true,
		replay: false,
		version: 2,
		updatedAt: now,
		expiresAt: now + consentLifetime,
		source: 'user',
	})
	assert.equal(createConsent({ analytics: false, replay: false }, now, 'gpc').source, 'gpc')
	assert.equal(parseConsent(JSON.stringify(record), now + consentLifetime), null)
})
test('missing, corrupt, legacy, future and changed-policy records fail closed', () => {
	const good = createConsent({ analytics: true, replay: true }, now)
	for (const value of [
		null,
		'',
		'{',
		'null',
		'"accepted"',
		JSON.stringify({ ...good, version: 1 }),
		JSON.stringify({ ...good, replay: undefined }),
		JSON.stringify({ ...good, analytics: 'true' }),
		JSON.stringify({ ...good, source: 'unknown' }),
		JSON.stringify({ ...good, updatedAt: now + 1 }),
		JSON.stringify({ ...good, expiresAt: now }),
		JSON.stringify({ ...good, expiresAt: now + consentLifetime + 1 }),
	])
		assert.equal(parseConsent(value, now), null)
})
