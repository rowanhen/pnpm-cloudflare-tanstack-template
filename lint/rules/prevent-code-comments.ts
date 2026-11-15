import { defineRule } from '@oxlint/plugins'

export const preventCodeComments = defineRule({
	create(context) {
		return {
			Program() {
				for (const comment of context.sourceCode.getAllComments()) {
					context.report({
						node: comment,
						message:
							'Review this code comment; keep only comments that explain a constraint or decision.',
					})
				}
			},
		}
	},
})
