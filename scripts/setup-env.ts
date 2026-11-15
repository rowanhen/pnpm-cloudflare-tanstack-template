import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { config } from '@dotenvx/dotenvx'

export const root = fileURLToPath(new URL('..', import.meta.url))
export async function setupEnv(): Promise<NodeJS.ProcessEnv> {
	const project: Record<string, string> = {}
	if (
		existsSync(resolve(root, '.env.store')) &&
		(existsSync(resolve(root, '.env.keys')) || process.env.DOTENV_PRIVATE_KEY_LOCAL)
	) {
		const result = config({ path: resolve(root, '.env.store'), processEnv: project, quiet: true })
		if (result.error) throw new Error('Unable to decrypt .env.store; check your dotenvx key.')
	}
	return { ...project, ...process.env }
}
