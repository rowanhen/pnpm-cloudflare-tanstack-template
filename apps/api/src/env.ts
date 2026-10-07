export interface Env {
	API_PROXY_SECRET?: string
	DB: D1Database
	FILES: R2Bucket
	ALLOWED_ORIGINS: string
	AUTH_URL: string
	BETTER_AUTH_SECRET: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
}
