import { resolve } from 'node:path'
import { defineRule, type ESTree } from '@oxlint/plugins'

export const noCrossFeatureTestImports = defineRule({
	create(context) {
		const filename = resolve(context.filename).replaceAll('\\', '/')
		const owner = /(?:^|\/)apps\/api\/src\/features\/([^/]+)\/tests\/[^/]+\.test\.tsx?$/.exec(
			filename,
		)?.[1]
		const check = (node: ESTree.Node, specifier: string) => {
			if (!owner || !specifier.startsWith('.')) return
			const target = resolve(filename, '..', specifier).replaceAll('\\', '/')
			const imported = /(?:^|\/)apps\/api\/src\/features\/([^/]+)(?:\/|$)/.exec(target)?.[1]
			if (imported && imported !== owner)
				context.report({
					node,
					message: `Unit tests for ${owner} must not import the ${imported} feature; test cross-feature behavior in integration tests.`,
				})
		}
		return {
			ImportDeclaration(node) {
				check(node.source, String(node.source.value))
			},
			ExportNamedDeclaration(node) {
				if (node.source) check(node.source, String(node.source.value))
			},
			ExportAllDeclaration(node) {
				check(node.source, String(node.source.value))
			},
			ImportExpression(node) {
				if (node.source.type === 'Literal' && typeof node.source.value === 'string')
					check(node.source, node.source.value)
			},
		}
	},
})
