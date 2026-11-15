import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test, onTestFinished } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

describe('project scripts', () => {
	test('when project setup runs in a fresh copy, names and bindings are updated', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'project-setup-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		for (const path of [
			'scripts/setup-project.ts',
			'package.json',
			'README.md',
			'packages/shared/src/project.ts',
			'apps/api/wrangler.json',
			'apps/marketing/wrangler.json',
			'apps/dashboard/wrangler.json',
		]) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await copyFile(join(root, path), join(directory, path))
		}
		const result = spawnSync(
			process.execPath,
			[join(directory, 'scripts/setup-project.ts'), 'Sample App'],
			{
				cwd: directory,
				encoding: 'utf8',
			},
		)
		assert.ifError(result.error)
		assert.equal(result.status, 0, result.stdout + result.stderr)
		assert.equal(
			JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).name,
			'sample-app',
		)
		assert.match(await readFile(join(directory, 'README.md'), 'utf8'), /^# sample-app\n/)
		const project = await readFile(join(directory, 'packages/shared/src/project.ts'), 'utf8')
		assert.match(project, /APP_NAME = 'sample-app'/)
		for (const app of ['api', 'marketing', 'dashboard']) {
			const config = JSON.parse(
				await readFile(join(directory, `apps/${app}/wrangler.json`), 'utf8'),
			)
			assert.equal(config.name, `sample-app-${app}`)
			if (app === 'api') {
				assert.equal(config.d1_databases[0].database_name, 'sample-app-db')
				assert.equal(config.r2_buckets[0].bucket_name, 'sample-app-files')
			} else assert.equal(config.services[0].service, 'sample-app-api')
		}
	})

	test('when local setup runs, it creates reusable secrets and frontend settings', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'local-setup-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		for (const path of [
			'scripts/setup-local.ts',
			'scripts/setup-env.ts',
			'scripts/posthog-env.ts',
			'scripts/tooling.ts',
			'apps/api/.dev.vars.example',
		]) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await copyFile(join(root, path), join(directory, path))
		}
		for (const app of ['marketing', 'dashboard'])
			await mkdir(join(directory, 'apps', app), { recursive: true })
		await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
		const run = (settings: Record<string, string> = {}) =>
			spawnSync(process.execPath, [join(directory, 'scripts/setup-local.ts')], {
				cwd: directory,
				encoding: 'utf8',
				env: { PATH: process.env.PATH ?? '', ...settings },
			})
		const first = run()
		assert.ifError(first.error)
		assert.equal(first.status, 0, first.stdout + first.stderr)
		const devVarsPath = join(directory, 'apps/api/.dev.vars')
		const devVars = await readFile(devVarsPath, 'utf8')
		assert.match(devVars, /BETTER_AUTH_SECRET="[a-f0-9]{64}"/)
		for (const app of ['marketing', 'dashboard']) {
			const frontendEnv = await readFile(join(directory, `apps/${app}/.env.local`), 'utf8')
			assert.match(frontendEnv, /VITE_APP_ENV="development"/)
		}
		const second = run()
		assert.ifError(second.error)
		assert.equal(second.status, 0, second.stdout + second.stderr)
		assert.equal(await readFile(devVarsPath, 'utf8'), devVars)
		const withCredentials = run({ GOOGLE_CLIENT_ID: 'local-client-id' })
		assert.equal(withCredentials.status, 0, withCredentials.stdout + withCredentials.stderr)
		assert.match(await readFile(devVarsPath, 'utf8'), /GOOGLE_CLIENT_ID="local-client-id"/)
		const withoutCredentials = run()
		assert.equal(
			withoutCredentials.status,
			0,
			withoutCredentials.stdout + withoutCredentials.stderr,
		)
		assert.equal(await readFile(devVarsPath, 'utf8'), devVars)
	})

	test('when deployment configuration is invalid, no service target changes', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'deployment-setup-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		for (const app of ['api', 'marketing', 'dashboard'])
			await mkdir(join(directory, 'apps', app), { recursive: true })
		await writeFile(
			join(directory, 'apps/api/wrangler.ci.json'),
			JSON.stringify({ name: 'api-prod', vars: { AUTH_URL: 'https://dashboard.example.test' } }),
		)
		const marketing = { name: 'marketing', services: [{ binding: 'API', service: 'old-api' }] }
		await writeFile(join(directory, 'apps/marketing/wrangler.json'), JSON.stringify(marketing))
		const dashboardPath = join(directory, 'apps/dashboard/wrangler.json')
		await writeFile(
			dashboardPath,
			JSON.stringify({ services: [{ binding: 'WRONG', service: 'old-api' }] }),
		)
		const run = () =>
			spawnSync(process.execPath, [join(root, 'scripts/configure-deployment.ts')], {
				cwd: directory,
				encoding: 'utf8',
				env: { ...process.env, VITE_SITE_URL: 'https://site.example.test' },
			})
		const invalid = run()
		assert.ifError(invalid.error)
		assert.notEqual(invalid.status, 0)
		assert.deepEqual(
			JSON.parse(await readFile(join(directory, 'apps/marketing/wrangler.json'), 'utf8')),
			marketing,
		)
		await writeFile(
			dashboardPath,
			JSON.stringify({ services: [{ binding: 'API', service: 'old-api' }] }),
		)
		const valid = run()
		assert.ifError(valid.error)
		assert.equal(valid.status, 0, valid.stdout + valid.stderr)
		assert.equal(
			JSON.parse(await readFile(join(directory, 'apps/api/wrangler.ci.json'), 'utf8')).vars
				.SITE_URL,
			'https://site.example.test',
		)
		for (const app of ['marketing', 'dashboard']) {
			const config = JSON.parse(
				await readFile(join(directory, `apps/${app}/wrangler.json`), 'utf8'),
			)
			assert.equal(config.services[0].service, 'api-prod')
		}
	})
})
