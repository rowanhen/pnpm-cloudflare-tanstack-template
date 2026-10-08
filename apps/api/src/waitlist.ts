import { sendEmail, emailEnabled } from './email'
import { database } from '@workspace/data/client'
import { waitlist } from '@workspace/data/schema'
import { inputs } from '@workspace/contracts'
import { HttpError, methodNotAllowed, readJson, reply, sha256 } from './http'
import { rateLimit } from './rate-limit'
import type { Env } from './env'

export async function waitlistRoute(request: Request, env: Env) {
	if (request.method !== 'POST') return methodNotAllowed('POST')
	const body = await readJson(request)
	const response = () =>
		reply('waitlist', { message: "You're on the list. Thanks for your interest!" }, 202)
	if (body.website) return response()
	const result = inputs.waitlist.safeParse(body)
	if (!result.success)
		throw new HttpError(400, 'Enter a valid email address and agree to join the waitlist')
	const { email, name, consent } = result.data
	await rateLimit(
		env.DB,
		`waitlist-ip:${await sha256(request.headers.get('cf-connecting-ip') ?? 'local')}`,
		10,
		3600,
	)
	await rateLimit(env.DB, `waitlist-email:${await sha256(email)}`, 3, 3600)
	const entry = await database(env.DB)
		.insert(waitlist)
		.values({ id: crypto.randomUUID(), email, name, consent })
		.onConflictDoNothing({ target: waitlist.email })
		.returning({ id: waitlist.id })
		.get()
	if (entry && emailEnabled(env)) {
		// Signup remains successful even when the provider cannot accept its confirmation.
		await sendEmail(env, {
			to: email,
			template: 'waitlist',
			dedupeKey: `waitlist:${entry.id}`,
		}).catch(() => undefined)
	}
	return response()
}
