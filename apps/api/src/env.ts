import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types'
import type { ServerConfig } from '@workspace/observability/server'
export interface Env extends ServerConfig {
	API_PROXY_SECRET?: string
	EMAIL?: SendEmail
	EMAIL_FROM?: string
	IDENTITY_DB: D1Database
	BILLING_DB: D1Database
	PRODUCT_DB: D1Database
	DATABASE_MAINTENANCE?: string
	FILES: R2Bucket
	ALLOWED_ORIGINS: string
	AUTH_URL: string
	BETTER_AUTH_SECRET: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	STRIPE_SECRET_KEY?: string
	STRIPE_PUBLISHABLE_KEY?: string
	STRIPE_PRICE_ID?: string
	STRIPE_DEMO_PRICE_ID?: string
	STRIPE_SUBSCRIPTION_PRICE_ID?: string
	STRIPE_WEBHOOK_SECRET?: string
}
