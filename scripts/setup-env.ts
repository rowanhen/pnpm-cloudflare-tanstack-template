import { hasCode } from './tooling.ts'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { config } from '@dotenvx/dotenvx'

export const root = fileURLToPath(new URL('..', import.meta.url))
export const envPath = resolve(root, process.env.STARTER_ENV_FILE ?? 'apps/api/.dev.vars')
export async function setupEnv(): Promise<NodeJS.ProcessEnv> {
	const project: Record<string, string> = {}
	if (
		existsSync(resolve(root, '.env.local')) &&
		(existsSync(resolve(root, '.env.keys')) || process.env.DOTENV_PRIVATE_KEY_LOCAL)
	) {
		const result = config({ path: resolve(root, '.env.local'), processEnv: project, quiet: true })
		if (result.error) throw new Error('Unable to decrypt .env.local; check your dotenvx key.')
	}
	return {
		...parseEnv(
			await readFile(envPath, 'utf8').catch((error) => {
				if (hasCode(error, 'ENOENT')) return ''
				throw error
			}),
		),
		...project,
		...process.env,
	}
}
