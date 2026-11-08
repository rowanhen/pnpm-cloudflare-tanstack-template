import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'

/** Report names only; never put configuration values or decryption keys in diagnostics. */
export function encryptedEnvErrors(source: string): string[] {
	const errors: string[] = []
	const names = new Set<string>()
	for (const [index, line] of source.split('\n').entries()) {
		if (!line.trim() || line.trimStart().startsWith('#')) continue
		const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
		if (!match) {
			errors.push(`.env.local:${index + 1}: expected a single-line assignment`)
			continue
		}
		const [, name] = match
		if (names.has(name)) errors.push(`.env.local: duplicate ${name}`)
		names.add(name)
		const value = parseEnv(line)[name] ?? ''
		if (name === 'DOTENV_PUBLIC_KEY_LOCAL') {
			if (!/^[a-f\d]{66}$/i.test(value)) errors.push(`.env.local: invalid public encryption key`)
		} else if (name.startsWith('DOTENV_PRIVATE_KEY')) {
			errors.push(`.env.local: private decryption keys must never be committed`)
		} else if (!/^encrypted:[A-Za-z\d+/]{100,}={0,2}$/.test(value)) {
			errors.push(`.env.local: ${name} must be dotenvx ciphertext`)
		}
	}
	if (!names.has('DOTENV_PUBLIC_KEY_LOCAL'))
		errors.push('.env.local: missing public encryption key')
	return errors
}

export function privateEnvFiles(paths: string[]): string[] {
	return paths.filter(
		(path) =>
			/(^|\/)\.env\.keys(?:\.|$)|(^|\/)\.dev\.vars(?:$|\.(?!example$))/.test(path) ||
			(path !== '.env.local' &&
				/(^|\/)\.env(?:\.[^/]+)?$/.test(path) &&
				!path.endsWith('.example')),
	)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const root = fileURLToPath(new URL('..', import.meta.url))
	const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
		.split('\0')
		.filter(Boolean)
	const errors = privateEnvFiles(tracked).map(
		(path) => `${path}: local/private environment files must not be tracked`,
	)
	if (tracked.includes('.env.local')) {
		errors.push(...encryptedEnvErrors(await readFile(resolve(root, '.env.local'), 'utf8')))
		const staged = execFileSync('git', ['show', ':.env.local'], { cwd: root, encoding: 'utf8' })
		errors.push(...encryptedEnvErrors(staged).map((error) => `Git index: ${error}`))
	}
	if (errors.length) {
		console.error(errors.join('\n'))
		process.exitCode = 1
	} else console.log('Tracked environment files contain no plaintext settings or private keys.')
}
