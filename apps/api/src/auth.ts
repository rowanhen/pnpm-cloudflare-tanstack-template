import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { database } from '@workspace/data/client'
import { users, sessions, accounts, verifications, auth_rate_limits } from '@workspace/data/schema'
import type { Env } from './env'

export function createAuth(env: Env) {
	return betterAuth({
		appName: 'Idea Starter',
		database: drizzleAdapter(database(env.DB), {
			provider: 'sqlite',
			schema: { users, sessions, accounts, verifications, auth_rate_limits },
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.AUTH_URL,
		trustedOrigins: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
		user: { modelName: 'users' },
		session: {
			modelName: 'sessions',
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: false },
		},
		account: {
			modelName: 'accounts',
			encryptOAuthTokens: true,
			accountLinking: { enabled: false },
			storeStateStrategy: 'database',
		},
		verification: { modelName: 'verifications' },
		emailAndPassword: { enabled: false },
		socialProviders:
			env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
				? {
						google: {
							clientId: env.GOOGLE_CLIENT_ID,
							clientSecret: env.GOOGLE_CLIENT_SECRET,
							prompt: 'select_account',
							accessType: 'online',
						},
					}
				: {},
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: 60,
			max: 30,
			modelName: 'auth_rate_limits',
		},
		advanced: {
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
			cookiePrefix: 'starter',
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: 'lax',
				secure: env.AUTH_URL.startsWith('https:'),
			},
		},
	})
}
