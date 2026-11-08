import type { Env } from '../env'
import { makeEmails } from '../features/emails/emails'
import { emailProvider } from '../features/emails/provider'
import { emailRepository } from '../features/emails/repository'
import { emailEnabled } from './configuration'
import { rateLimiter } from './rate-limit-resources'
export const emails = (env: Env, limiter = rateLimiter(env)) =>
	makeEmails({
		repository: emailRepository(env.DB),
		provider: emailProvider(env.EMAIL, env.EMAIL_FROM, emailEnabled(env)),
		limiter,
	})
