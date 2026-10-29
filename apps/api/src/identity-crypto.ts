import { Effect, Layer } from 'effect'
import { IdentityCrypto } from './identity'
async function sha256(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const IdentityCryptoLive = Layer.succeed(IdentityCrypto, {
	hash: (value) => Effect.promise(() => sha256(value)),
	token: Effect.sync(
		() =>
			`idea_${[...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`,
	),
})
