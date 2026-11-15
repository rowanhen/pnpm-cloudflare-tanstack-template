import { defineRule } from '@oxlint/plugins'
import { isTestCase } from './test-calls.ts'

export const requireTestName = defineRule({
	create(context) {
		return {
			CallExpression(node) {
				if (!isTestCase(node.callee)) return
				const name = node.arguments[0]
				if (
					name?.type === 'Literal' &&
					typeof name.value === 'string' &&
					/^when [^\n,]+, [^\n]+$/.test(name.value)
				)
					return
				context.report({
					node: name ?? node,
					message: 'Name tests "when <condition>, <observable outcome>" using a literal string.',
				})
			},
		}
	},
})
