import { resolve } from 'node:path'
import { defineRule, type ESTree } from '@oxlint/plugins'

export const requireFeatureTestLocation = defineRule({
	create(context) {
		const filename = resolve(context.filename).replaceAll('\\', '/')
		const unownedUnitTest = /(?:^|\/)(?:tests\/unit|apps\/api\/tests)\/[^/]+\.test\.tsx?$/.test(
			filename,
		)
		const checkUnownedImport = (node: ESTree.Node, specifier: string) => {
			if (!unownedUnitTest || !specifier.startsWith('.')) return
			const imported = resolve(filename, '..', specifier).replaceAll('\\', '/')
			if (/(?:^|\/)apps\/api\/src\/features\/[^/]+(?:\/|$)/.test(imported))
				context.report({
					node,
					message: "Move backend feature unit tests into their feature's tests/ folder.",
				})
		}
		return {
			Program(node) {
				const match = /(?:^|\/)apps\/api\/src\/features\/[^/]+\/(.+\.test\.tsx?)$/.exec(filename)
				if (
					match &&
					(!/^tests\/[^/]+\.test\.tsx?$/.test(match[1]) || match[1].includes('.integration.test.'))
				)
					context.report({
						node,
						message: "Put backend feature unit tests directly in that feature's tests/ folder.",
					})
			},
			ImportDeclaration(node) {
				checkUnownedImport(node.source, String(node.source.value))
			},
			ExportNamedDeclaration(node) {
				if (node.source) checkUnownedImport(node.source, String(node.source.value))
			},
			ExportAllDeclaration(node) {
				checkUnownedImport(node.source, String(node.source.value))
			},
			ImportExpression(node) {
				if (node.source.type === 'Literal' && typeof node.source.value === 'string')
					checkUnownedImport(node.source, node.source.value)
			},
		}
	},
})
