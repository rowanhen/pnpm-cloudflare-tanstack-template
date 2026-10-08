import { workerConfig } from './tooling.ts'
import packageManifest from '../package.json' with { type: 'json' }
import { createInterface } from 'node:readline/promises'
import { readFile, writeFile } from 'node:fs/promises'
import { stdin as input, stdout as output } from 'node:process'

const rawName = process.argv[2] ?? (await promptForName())
const projectName = normalizeProjectName(rawName)

if (!projectName || projectName.length > 40) {
	console.error('Project name must contain 1–40 characters after normalization.')
	process.exit(1)
}

const packageJsonPath = new URL('../package.json', import.meta.url)
const readmePath = new URL('../README.md', import.meta.url)
const projectConfigPath = new URL('../packages/shared/src/project.ts', import.meta.url)

const packageJson = structuredClone(packageManifest)
packageJson.name = projectName
await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`)

const readme = await readFile(readmePath, 'utf8')
await writeFile(readmePath, readme.replace(/^# .+$/m, `# ${projectName}`))

const projectConfig = await readFile(projectConfigPath, 'utf8')
await writeFile(
	projectConfigPath,
	projectConfig
		.replace(/PROJECT_NAME = '.*'/, `PROJECT_NAME = '${projectName}'`)
		.replace(/APP_NAME = '.*'/, `APP_NAME = '${projectName}'`),
)

const workerPath = new URL('../apps/api/wrangler.json', import.meta.url)
const worker = workerConfig()
worker.name = `${projectName}-api`
worker.d1_databases[0].database_name = `${projectName}-db`
worker.r2_buckets[0].bucket_name = `${projectName}-files`
await writeFile(workerPath, `${JSON.stringify(worker, null, '\t')}\n`)

console.log(`Initialized project as "${projectName}".`)
console.log('Next steps:')
console.log('1. pnpm install')
console.log(
	'2. pnpm dev (waitlist works locally; add Google OAuth credentials for dashboard login)',
)
console.log('3. Customize marketing copy/SEO and follow README.md for Google and Cloudflare setup')

async function promptForName() {
	const rl = createInterface({ input, output })
	try {
		return await rl.question('Project name: ')
	} finally {
		rl.close()
	}
}

function normalizeProjectName(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}
