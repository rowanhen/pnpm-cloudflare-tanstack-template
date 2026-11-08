import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encryptedEnvErrors, privateEnvFiles } from '../../scripts/check-env.ts'
const ciphertext = `encrypted:${'A'.repeat(128)}`
const publicKey = `DOTENV_PUBLIC_KEY_LOCAL="02${'a'.repeat(64)}"`
test('tracked project settings require encryption and never expose rejected values', () => {
	assert.deepEqual(encryptedEnvErrors(`${publicKey}\nSECRET="${ciphertext}"\n# comment\n`), [])
	for (const assignment of [
		'SECRET=private-example',
		'PUBLIC_URL=https://example.test',
		'SECRET=',
		'SECRET="encrypted:not-ciphertext"',
		'DOTENV_PRIVATE_KEY_LOCAL=private-example',
		'malformed',
	]) {
		const errors = encryptedEnvErrors(`${publicKey}\n${assignment}`)
		assert.ok(errors.length > 0)
		assert.ok(!errors.join('\n').includes('private-example'))
	}
	assert.ok(
		encryptedEnvErrors(`${publicKey}\nSECRET=${ciphertext}\nSECRET=${ciphertext}`).some((error) =>
			error.includes('duplicate'),
		),
	)
	assert.ok(
		encryptedEnvErrors('SECRET=encrypted:aa').some((error) => error.includes('missing public')),
	)
})
test('private and local files cannot become tracked configuration', () => {
	assert.deepEqual(
		privateEnvFiles(['.env.local', 'apps/api/.dev.vars.example', 'apps/marketing/.env.example']),
		[],
	)
	const privateFiles = [
		'.env.keys',
		'.env.keys.backup',
		'.env',
		'apps/api/.dev.vars',
		'apps/api/.dev.vars.production',
		'apps/dashboard/.env.local',
	]
	assert.deepEqual(privateEnvFiles(privateFiles), privateFiles)
})
