import { database } from '@workspace/data/client'
import { emailDeliveries, now, type EmailDelivery } from '@workspace/data/schema'
import { desc, eq } from 'drizzle-orm'
import type { User } from '@workspace/contracts'
import type { Env } from './env'
import { HttpError, input, methodNotAllowed, reply } from './http'
import { rateLimit } from './rate-limit'

export const emailEnabled = (env: Env) =>
	Boolean(env.EMAIL && env.EMAIL_FROM?.match(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/))
const templates = {
	waitlist: {
		subject: "You're on the list",
		text: "Thanks for joining our waitlist. We'll be in touch when we're ready.",
		html: "<h1>You're on the list</h1><p>Thanks for joining our waitlist. We'll be in touch when we're ready.</p>",
	},
	test: {
		subject: 'Hello from your workspace',
		text: 'Your email service is connected.',
		html: '<h1>Hello from your workspace</h1><p>Your email service is connected.</p>',
	},
} satisfies Record<
	EmailDelivery['template'],
	Pick<EmailMessageBuilder, 'subject' | 'text' | 'html'>
>

/** One provider attempt per key. A provider timeout can mean accepted: never retry blindly. */
export async function sendEmail(
	env: Env,
	options: { to: string; userId?: string; template: EmailDelivery['template']; dedupeKey: string },
) {
	if (!emailEnabled(env) || !env.EMAIL || !env.EMAIL_FROM)
		throw new HttpError(503, 'Email is not configured')
	const db = database(env.DB)
	const delivery = await db
		.insert(emailDeliveries)
		.values({
			id: crypto.randomUUID(),
			dedupe_key: options.dedupeKey,
			user_id: options.userId,
			to_email: options.to,
			template: options.template,
		})
		.onConflictDoNothing({ target: emailDeliveries.dedupe_key })
		.returning()
		.get()
	if (!delivery) {
		const existing = await db
			.select()
			.from(emailDeliveries)
			.where(eq(emailDeliveries.dedupe_key, options.dedupeKey))
			.get()
		if (existing?.status === 'accepted' && existing.message_id)
			return { id: existing.id, status: 'accepted' as const, messageId: existing.message_id }
		throw new HttpError(
			409,
			'This email was already attempted. Check its status before sending another.',
		)
	}
	let result: EmailSendResult
	try {
		result = await env.EMAIL.send({
			from: env.EMAIL_FROM,
			to: options.to,
			...templates[options.template],
		})
	} catch (error) {
		// Persist only a bounded provider code, never raw message content or addresses in logs.
		const code =
			error instanceof Error
				? (error.message.match(/\bE_[A-Z_]+\b/)?.[0] ?? 'SEND_FAILED')
				: 'SEND_FAILED'
		await db
			.update(emailDeliveries)
			.set({ status: 'failed', error_code: code, updated_at: now })
			.where(eq(emailDeliveries.id, delivery.id))
		console.error('Email attempt failed', { id: delivery.id, code })
		throw new HttpError(
			502,
			'Email could not be confirmed. Check its status before sending another.',
		)
	}
	// If this write fails, retain "sending" and do not attempt the provider again.
	await db
		.update(emailDeliveries)
		.set({ status: 'accepted', message_id: result.messageId, updated_at: now })
		.where(eq(emailDeliveries.id, delivery.id))
	return { id: delivery.id, status: 'accepted' as const, messageId: result.messageId }
}

export async function emailRoute(request: Request, env: Env, user: User) {
	if (request.method === 'GET') {
		const emails = await database(env.DB)
			.select({
				id: emailDeliveries.id,
				status: emailDeliveries.status,
				created_at: emailDeliveries.created_at,
			})
			.from(emailDeliveries)
			.where(eq(emailDeliveries.user_id, user.id))
			.orderBy(desc(emailDeliveries.created_at))
			.limit(10)
		return reply('emailStatus', { enabled: emailEnabled(env), emails })
	}
	if (request.method !== 'POST') return methodNotAllowed('GET, POST')
	if (!user.emailVerified) throw new HttpError(403, 'Verify your email before sending a test')
	const { requestId } = await input(request, 'sendEmail')
	if (!emailEnabled(env)) throw new HttpError(503, 'Email is not configured')
	await rateLimit(env.DB, `email-test:${user.id}`, 3, 3600)
	const email = await sendEmail(env, {
		to: user.email,
		userId: user.id,
		template: 'test',
		dedupeKey: `test:${user.id}:${requestId}`,
	})
	return reply('email', { email }, 202)
}
