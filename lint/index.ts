import { definePlugin } from '@oxlint/plugins'
import { preventCodeComments } from './rules/prevent-code-comments.ts'
import { requireTestName } from './rules/require-test-name.ts'
import { requireTestSuite } from './rules/require-test-suite.ts'
import { requireFeatureTestLocation } from './rules/require-feature-test-location.ts'
import { noCrossFeatureTestImports } from './rules/no-cross-feature-test-imports.ts'
import { requireModuleTestLocation } from './rules/require-module-test-location.ts'

export default definePlugin({
	meta: { name: 'project' },
	rules: {
		'prevent-code-comments': preventCodeComments,
		'require-test-name': requireTestName,
		'require-test-suite': requireTestSuite,
		'require-feature-test-location': requireFeatureTestLocation,
		'no-cross-feature-test-imports': noCrossFeatureTestImports,
		'require-module-test-location': requireModuleTestLocation,
	},
})
