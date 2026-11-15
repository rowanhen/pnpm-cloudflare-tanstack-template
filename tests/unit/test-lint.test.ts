import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test, onTestFinished } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

describe('test lint rules', () => {
	test('when test cases are linted, only named cases inside suites pass', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'test-lint-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		await writeFile(join(directory, '.oxlintrc.json'), await readFile(join(root, '.oxlintrc.json')))
		await symlink(join(root, 'lint'), join(directory, 'lint'), 'dir')
		const cases = [
			{
				path: 'tests/unit/ungrouped.test.ts',
				source: "import { test } from 'vitest'; test('when ready, works', () => {})",
				rule: 'project(require-test-suite)',
			},
			{
				path: 'tests/unit/dynamic.test.ts',
				source:
					"import { describe, test } from 'vitest'; const label = 'when ready, works'; describe('suite', () => test(label, () => {}))",
				rule: 'project(require-test-name)',
			},
			{
				path: 'tests/unit/ambiguous.test.ts',
				source:
					"import { describe, test } from 'vitest'; describe('suite', () => test('works', () => {}))",
				rule: 'project(require-test-name)',
			},
			{
				path: 'tests/unit/unnamed.test.ts',
				source:
					"import { describe, test } from 'vitest'; describe('', () => test('when ready, works', () => {}))",
				rule: 'project(require-test-suite)',
			},
			{
				path: 'tests/unit/only.test.ts',
				source:
					"import { describe, test } from 'vitest'; describe('suite', () => test.only('works', () => {}))",
				rule: 'project(require-test-name)',
			},
			{
				path: 'tests/unit/valid.test.ts',
				source:
					"import { describe, test } from 'vitest'; describe('suite', () => test('when ready, works', () => {}))",
				rule: undefined,
			},
			{
				path: 'tests/browser/valid.spec.ts',
				source:
					"import { test } from '@playwright/test'; test.describe('suite', () => test('when ready, works', () => {}))",
				rule: undefined,
			},
		] as const
		for (const { path, source, rule } of cases) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await writeFile(join(directory, path), source)
			const result = spawnSync(
				process.execPath,
				[join(root, 'node_modules/oxlint/bin/oxlint'), path],
				{ cwd: directory, encoding: 'utf8' },
			)
			assert.ifError(result.error)
			assert.equal(result.status, rule ? 1 : 0, result.stdout + result.stderr)
			if (rule)
				assert.match(result.stdout + result.stderr, new RegExp(rule.replace(/[()]/g, '\\$&')))
		}
	})

	test('when backend unit tests are linted, location and feature ownership are enforced', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'feature-test-lint-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		await writeFile(join(directory, '.oxlintrc.json'), await readFile(join(root, '.oxlintrc.json')))
		await symlink(join(root, 'lint'), join(directory, 'lint'), 'dir')
		const suite =
			"import { describe, test } from 'vitest'; describe('todos', () => test('when called, it works', () => {}))"
		const cases = [
			{
				path: 'apps/api/src/features/todos/tests/todos.test.ts',
				source: `import '../todos.ts'; import '../../../errors.ts'; ${suite}`,
				rule: undefined,
			},
			{
				path: 'apps/api/src/features/todos/todos.test.ts',
				source: suite,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'tests/unit/new-backend.test.ts',
				source: `import '../../apps/api/src/features/todos/todos.ts'; ${suite}`,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'apps/api/tests/new-backend.test.ts',
				source: `import '../src/features/todos/todos.ts'; ${suite}`,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'tests/unit/reexport-backend.test.ts',
				source: `export * from '../../apps/api/src/features/todos'; ${suite}`,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'apps/api/src/features/todos/tests/todos.integration.test.ts',
				source: suite,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'apps/api/src/features/todos/tests/nested/todos.test.ts',
				source: suite,
				rule: 'project(require-feature-test-location)',
			},
			{
				path: 'apps/api/src/features/todos/tests/cross.test.ts',
				source: `import '../../billing'; ${suite}`,
				rule: 'project(no-cross-feature-test-imports)',
			},
			{
				path: 'apps/api/src/features/todos/tests/type-only.test.ts',
				source: `import type { Billing } from '../../billing/billing.ts'; ${suite}`,
				rule: 'project(no-cross-feature-test-imports)',
			},
			{
				path: 'apps/api/src/features/todos/tests/dynamic.test.ts',
				source: `import('../../billing/billing.ts'); ${suite}`,
				rule: 'project(no-cross-feature-test-imports)',
			},
			{
				path: 'tests/integration/cross.test.ts',
				source: `import '../../apps/api/src/features/billing/billing.ts'; ${suite}`,
				rule: undefined,
			},
		] as const
		for (const { path, source, rule } of cases) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await writeFile(join(directory, path), source)
			const result = spawnSync(
				process.execPath,
				[join(root, 'node_modules/oxlint/bin/oxlint'), path],
				{
					cwd: directory,
					encoding: 'utf8',
				},
			)
			assert.ifError(result.error)
			assert.equal(result.status, rule ? 1 : 0, result.stdout + result.stderr)
			if (rule)
				assert.match(result.stdout + result.stderr, new RegExp(rule.replace(/[()]/g, '\\$&')))
		}
	})

	test('when frontend and package unit tests are linted, they belong beside their subject', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'module-test-lint-'))
		onTestFinished(() => rm(directory, { recursive: true, force: true }))
		await writeFile(join(directory, '.oxlintrc.json'), await readFile(join(root, '.oxlintrc.json')))
		await symlink(join(root, 'lint'), join(directory, 'lint'), 'dir')
		for (const path of [
			'packages/shared/src/lib/payment-view.ts',
			'packages/shared/src/components/link-button.tsx',
			'apps/marketing/src/lib/checkout-session.ts',
		]) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await writeFile(join(directory, path), 'export const subject = true')
		}
		const suite =
			"import { describe, test } from 'vitest'; describe('subject', () => test('when called, it works', () => {}))"
		const cases = [
			{
				path: 'packages/shared/src/lib/tests/payment-view.test.ts',
				source: suite,
				rule: undefined,
			},
			{
				path: 'packages/shared/src/components/tests/link-button.test.ts',
				source: suite,
				rule: undefined,
			},
			{
				path: 'apps/marketing/src/lib/tests/checkout-session.test.ts',
				source: suite,
				rule: undefined,
			},
			{
				path: 'packages/shared/src/lib/payment-view.test.ts',
				source: suite,
				rule: 'project(require-module-test-location)',
			},
			{
				path: 'packages/shared/src/lib/tests/checkout.test.ts',
				source: suite,
				rule: 'project(require-module-test-location)',
			},
			{
				path: 'tests/unit/shared.test.ts',
				source: `import '../../packages/shared/src/lib/payment-view.ts'; ${suite}`,
				rule: 'project(require-module-test-location)',
			},
			{
				path: 'tests/unit/alias.test.ts',
				source: `import '@workspace/shared/server-proxy'; ${suite}`,
				rule: 'project(require-module-test-location)',
			},
			{
				path: 'tests/integration/shared.test.ts',
				source: `import '../../packages/shared/src/lib/payment-view.ts'; ${suite}`,
				rule: undefined,
			},
		] as const
		for (const { path, source, rule } of cases) {
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await writeFile(join(directory, path), source)
			const result = spawnSync(
				process.execPath,
				[join(root, 'node_modules/oxlint/bin/oxlint'), path],
				{
					cwd: directory,
					encoding: 'utf8',
				},
			)
			assert.ifError(result.error)
			assert.equal(result.status, rule ? 1 : 0, result.stdout + result.stderr)
			if (rule)
				assert.match(result.stdout + result.stderr, new RegExp(rule.replace(/[()]/g, '\\$&')))
		}
	})
})
