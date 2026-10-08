import { z } from 'zod'
import type {
	ApiKey,
	Todo as TodoRow,
	User as UserRow,
	Order as OrderRow,
	WaitlistEntry,
	EmailDelivery,
} from '@workspace/data/schema'

// Public projections are derived from Drizzle. No hashes, tokens or owner IDs in read DTOs.
export type Todo = Omit<TodoRow, 'user_id'>
export type User = Pick<UserRow, 'id' | 'name' | 'email' | 'emailVerified' | 'image'>
export type Key = Omit<ApiKey, 'user_id' | 'key_hash'>
export type KeyScope = ApiKey['scope']
export type Order = Pick<OrderRow, 'id' | 'amount' | 'currency' | 'credits' | 'status'>
export type StoredFile = { key: string; size: number; etag: string; uploaded: string }
export type BillingStatus = {
	balance: number
	summaryCost: number
	packCredits: number
	activity: { id: string; type: string; credits: number; created_at: string }[]
}
export type CheckoutConfig = {
	publishableKey: string
	offer: {
		name: string
		description: string | null
		amount: number
		currency: string
		credits: number
		priceId: string
	}
}
export type CheckoutSession = {
	clientSecret: string | null
	sessionId: string
	status: 'open' | 'complete' | 'expired' | null
}
export type OrderStatus = { order: Order; checkoutStatus: CheckoutSession['status'] }

const title = z.string().trim().min(1).max(200)
export const keyScope = z.enum(['todos:read', 'summary:read']) satisfies z.ZodType<KeyScope>
export const inputs = {
	createTodo: z.strictObject({ title }),
	updateTodo: z
		.strictObject({ title: title.optional(), completed: z.boolean().optional() })
		.refine(
			(value) => value.title !== undefined || value.completed !== undefined,
			'Provide title or completed',
		),
	createKey: z.strictObject({
		name: z.string().trim().min(1).max(60),
		scope: keyScope.default('todos:read'),
	}),
	createCheckout: z.strictObject({ requestId: z.uuid() }),
	summary: z.strictObject({ status: z.enum(['all', 'open', 'completed']).default('all') }),
	waitlist: z.strictObject({
		email: z
			.email()
			.max(254)
			.transform((value) => value.toLowerCase()),
		name: z.string().trim().max(100).default(''),
		consent: z.literal(true),
		website: z.string().optional(),
	}),
	sendEmail: z.strictObject({ requestId: z.uuid() }),
}
export type Output<K extends keyof typeof inputs> = z.output<(typeof inputs)[K]>
export type Input<K extends keyof typeof inputs> = z.input<(typeof inputs)[K]>
export interface Responses {
	config: { googleEnabled: boolean; checkoutEnabled: boolean; emailEnabled: boolean }
	todos: { todos: Todo[] }
	todo: { todo: Todo }
	files: { files: StoredFile[]; cursor: string | null }
	file: { file: Omit<StoredFile, 'uploaded'> }
	keys: { keys: Key[] }
	createKey: { key: Pick<Key, 'id' | 'name' | 'prefix' | 'scope'> & { token: string } }
	billing: BillingStatus
	checkoutConfig: CheckoutConfig
	createCheckout: CheckoutSession
	order: OrderStatus
	me: { user: User }
	waitlistStatus: { joined: boolean; entry: Pick<WaitlistEntry, 'created_at'> | null }
	waitlist: { message: string }
	email: { email: { id: string; status: 'accepted'; messageId: string } }
	emailStatus: { enabled: boolean; emails: Pick<EmailDelivery, 'id' | 'status' | 'created_at'>[] }
}
export const routes = {
	config: '/api/config',
	todos: '/api/todos',
	files: '/api/files',
	keys: '/api/keys',
	billing: '/api/billing',
	checkoutConfig: '/api/checkout/config',
	me: '/api/me',
	waitlistStatus: '/api/waitlist/me',
	emailStatus: '/api/email',
} as const satisfies Partial<Record<keyof Responses, string>>

export const mutations = {
	createTodo: { path: '/api/todos', method: 'POST', response: 'todo' },
	createKey: { path: '/api/keys', method: 'POST', response: 'createKey' },
	createCheckout: { path: '/api/checkout/sessions', method: 'POST', response: 'createCheckout' },
	waitlist: { path: '/api/waitlist', method: 'POST', response: 'waitlist' },
	sendEmail: { path: '/api/email', method: 'POST', response: 'email' },
} as const satisfies Partial<
	Record<keyof typeof inputs, { path: string; method: string; response: keyof Responses }>
>
