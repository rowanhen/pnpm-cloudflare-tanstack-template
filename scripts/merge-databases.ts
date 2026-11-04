import { parseArgs } from 'node:util'
import { mkdir, readFile, writeFile, chmod, symlink } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { domains, type Domain } from '../packages/data/src/domains.ts'
import { readDump, rows, copySql, verifyCopy } from './database-copy.ts'
import { root, setupEnv } from './setup-env.ts'

const { values } = parseArgs({
	options: {
		'source-config': { type: 'string' },
		'target-config': { type: 'string' },
		'source-binding': { type: 'string', default: 'DB' },
		'backup-dir': { type: 'string' },
		'persist-to': { type: 'string' },
		'maintenance-url': { type: 'string' },
		remote: { type: 'boolean' },
		local: { type: 'boolean' },
	},
})
if (
	!values['source-config'] ||
	!values['target-config'] ||
	!values['backup-dir'] ||
	values.remote === values.local
)
	throw new Error(
		'Provide --source-config, --target-config, --backup-dir and exactly one of --local/--remote',
	)
if (values.remote) {
	if (!values['maintenance-url'])
		throw new Error('Remote cutover requires --maintenance-url https://your-api/api/health')
	const health: unknown = await (await fetch(values['maintenance-url'])).json()
	if (
		!health ||
		typeof health !== 'object' ||
		!('maintenance' in health) ||
		health.maintenance !== true
	)
		throw new Error('Put the deployed API into DATABASE_MAINTENANCE=true before copying live data')
}
let sourceConfig = resolve(values['source-config'])
let targetConfig = resolve(values['target-config'])
const sourceSettings = JSON.parse(await readFile(sourceConfig, 'utf8')) as {
	d1_databases: { binding: string; database_id: string }[]
}
const targetSettings = JSON.parse(await readFile(targetConfig, 'utf8')) as typeof sourceSettings
const targetId = targetSettings.d1_databases.find((db) => db.binding === 'DB')?.database_id
if (!targetId || targetSettings.d1_databases.length !== 1)
	throw new Error('Target must contain exactly one DB binding')
const sources = Object.entries(domains).map(([domain, { binding }]) => {
	const source =
		sourceSettings.d1_databases.find((db) => db.binding === binding) ??
		sourceSettings.d1_databases.find((db) => db.binding === values['source-binding'])
	if (!source || source.database_id === targetId)
		throw new Error(`Use a fresh target database distinct from ${binding}`)
	return { domain: domain as Domain, binding: source.binding }
})
const backup = resolve(values['backup-dir'])
await mkdir(backup, { mode: 0o700 }) // Deliberately refuse an existing backup directory.
const env = await setupEnv()
// D1 export has no --persist-to flag. Local configs share an explicit state symlink.
if (values.local) {
	const persistence = resolve(
		values['persist-to'] ?? join(dirname(targetConfig), '.wrangler/state'),
	)
	await mkdir(persistence, { recursive: true })
	await mkdir(join(backup, '.wrangler'))
	await symlink(persistence, join(backup, '.wrangler/state'), 'dir')
	async function localConfig(path: string, name: string) {
		const config = JSON.parse(await readFile(path, 'utf8')) as {
			main?: string
			d1_databases: { migrations_dir?: string }[]
		}
		if (config.main) config.main = resolve(dirname(path), config.main)
		for (const db of config.d1_databases)
			db.migrations_dir = resolve(dirname(path), db.migrations_dir ?? 'migrations')
		const target = join(backup, name)
		await writeFile(target, JSON.stringify(config), { mode: 0o600 })
		return target
	}
	sourceConfig = await localConfig(sourceConfig, 'source-config.json')
	targetConfig = await localConfig(targetConfig, 'target-config.json')
}
const common = [values.remote ? '--remote' : '--local']
const run = (args: string[]) =>
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', ...args], { cwd: root, env, stdio: 'pipe' })
async function exportDb(binding: string, config: string, name: string) {
	const path = join(backup, name)
	run(['export', binding, '--config', config, ...common, '--output', path])
	await chmod(path, 0o600)
	return readDump(await readFile(path, 'utf8'))
}
const snapshots = new Map<string, ReturnType<typeof readDump>>()
function snapshot(binding: string) {
	const source = snapshots.get(binding)
	if (!source) throw new Error(`Missing source snapshot: ${binding}`)
	return source
}
try {
	// Export every source before changing the destination. Keep private backups for rollback.
	for (const { binding } of sources) {
		if (!snapshots.has(binding))
			snapshots.set(binding, await exportDb(binding, sourceConfig, `${binding}-source.sql`))
	}
	const known = new Set(Object.values(domains).flatMap((domain) => [...domain.tables]) as string[])
	for (const source of snapshots.values()) {
		for (const { name } of source
			.prepare("SELECT name FROM sqlite_schema WHERE type='table'")
			.all()) {
			if (
				typeof name === 'string' &&
				!known.has(name) &&
				name !== 'd1_migrations' &&
				!name.startsWith('_cf_') &&
				!name.startsWith('sqlite_')
			)
				throw new Error(`Source table has no mapping: ${name}`)
		}
	}
	run(['migrations', 'apply', 'DB', '--config', targetConfig, ...common])
	const before = await exportDb('DB', targetConfig, 'target-before.sql')
	try {
		if ([...known].some((table) => rows(before, table).length))
			throw new Error('Destination is not empty')
	} finally {
		before.close()
	}
	const path = join(backup, 'application-data.sql')
	await writeFile(
		path,
		sources.map(({ domain, binding }) => copySql(snapshot(binding), domain)).join('\n'),
		{ mode: 0o600 },
	)
	run(['execute', 'DB', '--config', targetConfig, ...common, '--file', path])
	const target = await exportDb('DB', targetConfig, 'target-verified.sql')
	try {
		for (const { domain, binding } of sources) verifyCopy(snapshot(binding), target, domain)
	} finally {
		target.close()
	}
	console.log(
		'Every record verified. Sources unchanged. Deploy the DB binding before disabling maintenance.',
	)
} finally {
	for (const source of snapshots.values()) source.close()
}
