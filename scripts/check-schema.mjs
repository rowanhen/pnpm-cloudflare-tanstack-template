import { mkdtemp, cp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './setup-env.mjs'

const temporary = await mkdtemp(join(tmpdir(), 'starter-schema-'))
try {
	await cp(resolve(root, 'apps/api/migrations/meta'), join(temporary, 'meta'), { recursive: true })
	const result = spawnSync(
		'pnpm',
		[
			'--filter',
			'@workspace/data',
			'exec',
			'drizzle-kit',
			'generate',
			'--dialect',
			'sqlite',
			'--schema',
			resolve(root, 'packages/data/src/schema.ts'),
			'--out',
			relative(resolve(root, 'packages/data'), temporary),
		],
		{ cwd: root, encoding: 'utf8' },
	)
	if (result.error) throw result.error
	if (result.status !== 0 || !result.stdout.includes('No schema changes')) {
		console.error(result.stdout, result.stderr)
		throw new Error(
			'Schema differs from its migration snapshot. Run pnpm db:generate and review the SQL.',
		)
	}
	if ((await readdir(temporary)).some((file) => file.endsWith('.sql')))
		throw new Error('Uncommitted schema migration')
	console.log('Drizzle schema matches the committed migration snapshot.')
} finally {
	await rm(temporary, { recursive: true, force: true })
}
