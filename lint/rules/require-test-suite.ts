import { defineRule, type ESTree } from '@oxlint/plugins'
import { isDescribe, isTestCase } from './test-calls.ts'

export const requireTestSuite = defineRule({
	create(context) {
		return {
			CallExpression(node) {
				if (!isTestCase(node.callee)) return
				let parent: ESTree.Node | null = node.parent
				while (parent) {
					if (parent.type === 'CallExpression' && isDescribe(parent.callee)) {
						const name = parent.arguments[0]
						if (name?.type === 'Literal' && typeof name.value === 'string' && name.value.trim())
							return
						context.report({
							node: name ?? parent,
							message: 'Give this describe suite a literal name.',
						})
						return
					}
					parent = parent.parent
				}
				context.report({ node, message: 'Put this test inside a named describe suite.' })
			},
		}
	},
})
