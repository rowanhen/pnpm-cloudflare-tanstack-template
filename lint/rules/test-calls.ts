import type { ESTree } from '@oxlint/plugins'

function callName(callee: ESTree.CallExpression['callee']): string | undefined {
	if (callee.type === 'Identifier') return callee.name
	if (
		callee.type !== 'MemberExpression' ||
		callee.computed ||
		callee.property.type !== 'Identifier'
	)
		return undefined
	const object = callName(callee.object)
	return object && `${object}.${callee.property.name}`
}

export function isTestCase(callee: ESTree.CallExpression['callee']) {
	return [
		'test',
		'it',
		'test.only',
		'test.skip',
		'test.fixme',
		'test.todo',
		'it.only',
		'it.skip',
		'it.todo',
	].includes(callName(callee) ?? '')
}

export function isDescribe(callee: ESTree.CallExpression['callee']) {
	return [
		'describe',
		'describe.only',
		'describe.skip',
		'test.describe',
		'test.describe.only',
		'test.describe.skip',
	].includes(callName(callee) ?? '')
}
