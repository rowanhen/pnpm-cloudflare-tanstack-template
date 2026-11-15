import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import { makeWaitlist } from '../waitlist.ts'
import type { IdentityCrypto } from '../../../identity.ts'
const identity: IdentityCrypto = {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
}
const user = {
	id: 'owner',
	name: 'Owner',
	email: 'owner@example.test',
	emailVerified: true,
	image: null,
}

describe('waitlist', () => {
	test('when waitlist preflight or verification fails, side effects are avoided', async () => {
		const calls: string[] = []
		const service = makeWaitlist({
			crypto: identity,
			repository: {
				join: () =>
					Effect.sync(() => {
						calls.push('insert')
						return 'entry'
					}),
				find: () =>
					Effect.sync(() => {
						calls.push('find')
						return { created_at: 'now' }
					}),
			},
			email: {
				confirm: () =>
					Effect.sync(() => {
						calls.push('confirm')
					}),
			},
			limiter: {
				check: (key, limit) =>
					Effect.sync(() => {
						calls.push(key)
						return { limit, remaining: 1, reset: 1 }
					}),
			},
		})
		await Effect.runPromise(
			service.join({ email: 'a@example.test', name: '', consent: true, website: 'bot' }, 'ip'),
		)
		assert.deepEqual(calls, [])
		const status = await Effect.runPromise(service.status({ ...user, emailVerified: false }))
		assert.deepEqual(status, { joined: false, entry: null })
		await Effect.runPromise(
			service.join({ email: 'A@example.test', name: '', consent: true, website: '' }, 'ip'),
		)
		assert.deepEqual(calls, [
			'waitlist-ip:hash:ip',
			'waitlist-email:hash:a@example.test',
			'insert',
			'confirm',
		])
	})
})
