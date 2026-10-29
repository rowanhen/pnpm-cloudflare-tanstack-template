import { Effect } from 'effect'
import {
	getWaitlistStatus as operation,
	type GetWaitlistStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { waitlist } from '@workspace/data/product'
import { productDatabase } from '@workspace/data/client'
import { eq } from 'drizzle-orm'
export const getWaitlistStatus: GetWaitlistStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const entry = context.user.emailVerified
			? yield* attempt(operation, () =>
					productDatabase(context.env.PRODUCT_DB)
						.select({ created_at: waitlist.created_at })
						.from(waitlist)
						.where(eq(waitlist.email, context.user.email))
						.get(),
				)
			: undefined
		return { status: 200, body: { joined: Boolean(entry), entry: entry ?? null } }
	})
