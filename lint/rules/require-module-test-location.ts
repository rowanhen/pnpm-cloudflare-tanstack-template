import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { defineRule, type ESTree } from '@oxlint/plugins'

const moduleRoot = /(?:^|\/)(?:apps\/(?:dashboard|marketing)|packages\/[^/]+)\/src\//

export const requireModuleTestLocation = defineRule({
	create(context) {
		const filename = resolve(context.filename).replaceAll('\\', '/')
		const rootUnitTest = /(?:^|\/)tests\/unit\/[^/]+\.test\.tsx?$/.test(filename)
		const checkRootImport = (node: ESTree.Node, specifier: string) => {
			if (!rootUnitTest) return
			const target = specifier.startsWith('.')
				? resolve(filename, '..', specifier).replaceAll('\\', '/')
				: specifier
			if (
				moduleRoot.test(target) ||
				/^@workspace\/(?:shared|contracts|observability|data)(?:\/|$)/.test(target)
			)
				context.report({
					node,
					message: 'Move frontend and package unit tests beside the module they exercise.',
				})
		}
		return {
			Program(node) {
				if (!moduleRoot.test(filename) || !/\.test\.tsx?$/.test(filename)) return
				if (basename(dirname(filename)) !== 'tests') {
					context.report({
						node,
						message: 'Put frontend and package unit tests in a tests/ folder beside their subject.',
					})
					return
				}
				const subject = resolve(
					dirname(filename),
					'..',
					basename(filename).replace(/\.test\.tsx?$/, ''),
				)
				if (existsSync(`${subject}.ts`) || existsSync(`${subject}.tsx`)) return
				context.report({
					node,
					message: 'Name this unit test after a source module beside its tests/ folder.',
				})
			},
			ImportDeclaration(node) {
				checkRootImport(node.source, String(node.source.value))
			},
			ExportNamedDeclaration(node) {
				if (node.source) checkRootImport(node.source, String(node.source.value))
			},
			ExportAllDeclaration(node) {
				checkRootImport(node.source, String(node.source.value))
			},
			ImportExpression(node) {
				if (node.source.type === 'Literal' && typeof node.source.value === 'string')
					checkRootImport(node.source, node.source.value)
			},
		}
	},
})
