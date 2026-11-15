import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { MissingRecord } from '../src/errors.ts'
import { preserveFatal } from '../src/effect-errors.ts'

describe('Effect error handling', () => {
	test('when a fatal cause accompanies a typed error, recovery still fails', async () => {
		for (const reason of [Cause.makeDieReason(new Error('defect')), Cause.makeInterruptReason()]) {
			const cause = Cause.fromReasons([
				Cause.makeFailReason(new MissingRecord({ message: 'Todo not found' })),
				reason,
			])
			const result = await Effect.runPromiseExit(
				Effect.failCause(cause).pipe(
					preserveFatal,
					Effect.catchTag('MissingRecord', () => Effect.succeed('must not recover')),
				),
			)
			assert.ok(Exit.isFailure(result))
			assert.ok(Cause.hasDies(result.cause) || Cause.hasInterrupts(result.cause))
		}
	})
})
