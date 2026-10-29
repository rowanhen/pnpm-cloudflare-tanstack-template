import { Effect } from 'effect'
import {
	getEmailStatus as operation,
	type GetEmailStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { emailStatus } from './delivery'
export const getEmailStatus: GetEmailStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () => emailStatus(context.env, context.user))
		return { status: 200, body }
	})
