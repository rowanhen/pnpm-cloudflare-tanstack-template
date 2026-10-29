import { sendEmail, emailEnabled } from '../emails/delivery'
import { productDatabase } from '@workspace/data/client'
import { waitlist } from '@workspace/data/product'
import type { JoinWaitlistInput } from '@workspace/contracts/operations'
import { sha256 } from '../../identity-hash'
import { rateLimit } from '../../rate-limit'
import type { Env } from '../../env'

export async function joinWaitlist(request: Request, env: Env, body: JoinWaitlistInput['body']) {
	const response = () => ({ message: "You're on the list. Thanks for your interest!" })
	if (body.website) return response()
	const email = body.email.toLowerCase()
	const name = body.name.trim()
	const consent = body.consent

	await rateLimit(
		env.IDENTITY_DB,
		`waitlist-ip:${await sha256(request.headers.get('cf-connecting-ip') ?? 'local')}`,
		10,
		3600,
	)
	await rateLimit(env.IDENTITY_DB, `waitlist-email:${await sha256(email)}`, 3, 3600)
	const entry = await productDatabase(env.PRODUCT_DB)
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
