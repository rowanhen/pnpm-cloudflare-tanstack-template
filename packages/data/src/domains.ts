export const domains = {
	identity: {
		binding: 'IDENTITY_DB',
		tables: [
			'users',
			'sessions',
			'accounts',
			'verifications',
			'auth_rate_limits',
			'api_keys',
			'rate_limits',
		],
	},
	billing: {
		binding: 'BILLING_DB',
		tables: ['orders', 'stripe_events', 'credit_accounts', 'credit_grants', 'paid_requests'],
	},
	product: {
		binding: 'PRODUCT_DB',
		tables: ['todos', 'waitlist', 'email_deliveries'],
	},
} as const
export type Domain = keyof typeof domains
