import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('..', import.meta.url))
export const envPath = resolve(root, process.env.STARTER_ENV_FILE ?? 'apps/api/.dev.vars')
export async function setupEnv() {
	return {
		...parseEnv(
			await readFile(envPath, 'utf8').catch((error) => {
				if (error.code === 'ENOENT') return ''
				throw error
			}),
		),
		...process.env,
	}
}
