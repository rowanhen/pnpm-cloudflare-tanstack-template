import { Effect, Layer, Schema } from 'effect'
import type { Env } from '../../env'
import { ProviderFailure, Unavailable } from '../../errors'
import type { Mail } from './domain'
import { EmailProvider } from './service'
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
} satisfies Record<Mail['template'], Pick<EmailMessageBuilder, 'subject' | 'text' | 'html'>>

export const emailProviderLayer = (
	binding: Env['EMAIL'],
	from: string | undefined,
	enabled: boolean,
) =>
	Layer.succeed(EmailProvider, {
		enabled,
		send: (to, template) =>
			Effect.gen(function* () {
				if (!enabled || !binding || !from)
					return yield* Effect.fail(new Unavailable({ message: 'Email is not configured' }))
				const result = yield* Effect.tryPromise({
					try: () => binding.send({ from, to, ...templates[template] }),
					catch: (cause) =>
						new ProviderFailure({
							message: 'Email could not be confirmed. Check its status before sending another.',
							cause,
						}),
				})
				return yield* Schema.decodeUnknownEffect(
					Schema.Struct({ messageId: Schema.String.check(Schema.isMinLength(1)) }),
				)(result).pipe(
					Effect.map((value) => value.messageId),
					Effect.mapError(
						(cause) =>
							new ProviderFailure({
								message:
									'Email returned an invalid receipt. Check its status before sending another.',
								cause,
							}),
					),
				)
			}),
	})
