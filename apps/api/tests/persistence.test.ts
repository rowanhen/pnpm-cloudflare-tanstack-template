import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { storageEffect } from '../src/persistence.ts'

describe('storage Effects', () => {
	test('when a workflow is interrupted, non-abortable storage settles before cleanup', async () => {
		let start: (() => void) | undefined
		const started = new Promise<void>((resolve) => {
			start = resolve
		})
		let release: ((value: string) => void) | undefined
		const query = new Promise<string>((resolve) => {
			release = resolve
		})
		const controller = new AbortController()
		let cleaned = false
		const result = Effect.runPromiseExit(
			storageEffect(() => {
				assert.ok(start)
				start()
				return query
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						cleaned = true
					}),
				),
			),
			{ signal: controller.signal },
		)
		await started
		controller.abort()
		await Promise.resolve()
		assert.equal(cleaned, false)
		assert.ok(release)
		release('saved')
		const exit = await result
		assert.ok(Exit.isFailure(exit))
		assert.ok(Cause.hasInterrupts(exit.cause))
		assert.equal(cleaned, true)
	})
})
