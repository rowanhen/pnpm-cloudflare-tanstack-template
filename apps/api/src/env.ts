import type { ServerConfig } from '@workspace/observability/server'
export interface Env extends ServerConfig {
	API_PROXY_SECRET?: string
	EMAIL?: SendEmail
	EMAIL_FROM?: string
	DB: D1Database
	FILES: R2Bucket
	ALLOWED_ORIGINS: string
	AUTH_URL: string
	BETTER_AUTH_SECRET: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	STRIPE_SECRET_KEY?: string
	STRIPE_PUBLISHABLE_KEY?: string
	STRIPE_PRICE_ID?: string
	STRIPE_WEBHOOK_SECRET?: string
}
