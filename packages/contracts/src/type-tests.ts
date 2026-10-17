import { Effect } from 'effect'
import type { GetTodoFailure, GetTodoHandler } from './generated/operations'

// These assertions run as part of typecheck; an unused @ts-expect-error fails CI.
// @ts-expect-error A 404 must carry the not-found body, never the forbidden body.
const mismatchedStatus: GetTodoFailure = { status: 404, body: { code: 'forbidden', error: 'No' } }
// @ts-expect-error Undeclared status codes are rejected.
const undeclaredStatus: GetTodoFailure['status'] = 418
// @ts-expect-error A success response cannot be returned through the failure channel.
const successAsFailure: GetTodoHandler = () => Effect.fail({ status: 200, body: { todo: {} } })
const forbiddenSuccess = Effect.succeed({
	status: 404 as const,
	body: { code: 'todo_not_found', error: 'No' },
})
// @ts-expect-error A declared failure cannot be returned through the success channel.
const failureAsSuccess: GetTodoHandler = () => forbiddenSuccess
// @ts-expect-error Unknown service errors must be handled before crossing the operation boundary.
const undeclaredFailure: GetTodoHandler = () => Effect.fail(new Error('database details'))
void [mismatchedStatus, undeclaredStatus, successAsFailure, failureAsSuccess, undeclaredFailure]
