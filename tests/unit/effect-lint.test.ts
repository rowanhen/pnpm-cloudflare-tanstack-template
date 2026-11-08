import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../..', import.meta.url))

test('Effect lint fails on discarded and nested Effects, and accepts composed Effects', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'effect-lint-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
	const config = JSON.parse(await readFile(join(root, 'apps/api/tsconfig.json'), 'utf8'))
	config.compilerOptions.types = []
	config.include = ['example.ts']
	await writeFile(join(directory, 'tsconfig.json'), JSON.stringify(config))
	const lint = () =>
		spawnSync(
			'pnpm',
			[
				'exec',
				'effect-tsgo',
				'diagnostics',
				'--project',
				join(directory, 'tsconfig.json'),
				'--strict',
				'--format',
				'json',
			],
			{ cwd: root, encoding: 'utf8' },
		)
	await writeFile(
		join(directory, 'example.ts'),
		`import { Effect } from 'effect'
export const discarded = Effect.gen(function* () {
 Effect.succeed(1)
 return 2
})
export const nested = Effect.gen(function* () {
 return Effect.succeed(1)
})
`,
	)
	const invalid = lint()
	assert.ifError(invalid.error)
	assert.notEqual(invalid.status, 0, invalid.stdout + invalid.stderr)
	const diagnostics = JSON.parse(invalid.stdout).diagnostics
	assert.ok(
		diagnostics.some((d: { name: string }) => d.name === 'floatingEffect'),
		invalid.stdout,
	)
	assert.ok(
		diagnostics.some((d: { name: string }) => d.name === 'returnEffectInGen'),
		invalid.stdout,
	)
	await writeFile(
		join(directory, 'example.ts'),
		"import { Effect } from 'effect'\nexport const empty = Effect.succeed(undefined)\n",
	)
	const warning = lint()
	assert.ifError(warning.error)
	assert.notEqual(warning.status, 0, warning.stdout + warning.stderr)
	assert.ok(
		JSON.parse(warning.stdout).diagnostics.some(
			(d: { name: string; severity: string }) =>
				d.name === 'effectSucceedWithUndefined' && d.severity === 'warning',
		),
		warning.stdout,
	)
	await writeFile(
		join(directory, 'example.ts'),
		`import { Effect } from 'effect'
export const composed = Effect.gen(function* () {
 const value = yield* Effect.succeed(1)
 return value + 1
})
`,
	)
	const valid = lint()
	assert.ifError(valid.error)
	assert.equal(valid.status, 0, valid.stdout + valid.stderr)
	assert.deepEqual(JSON.parse(valid.stdout).diagnostics, [])
})
