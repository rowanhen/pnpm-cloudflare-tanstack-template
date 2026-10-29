import { existsSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { API, type Type } from 'typescript/unstable/sync'
import * as ts from 'typescript/unstable/ast'

// TypeScript is pinned. Its compiler AST/type information prevents regex-based import and D1 loopholes.
export function checkArchitecture(root: string): string[] {
	const directory = resolve(root, 'apps/api/src')
	const api = new API({ cwd: root })
	const errors: string[] = []
	try {
		const snapshot = api.updateSnapshot({ openProjects: [resolve(root, 'apps/api/tsconfig.json')] })
		const project = snapshot.getProject(resolve(root, 'apps/api/tsconfig.json'))
		if (!project) throw new Error('API TypeScript project could not be loaded')
		const { program, checker } = project
		if (program.getSyntacticDiagnostics().length)
			throw new Error('Fix TypeScript syntax before checking architecture')
		const files = new Map(
			program
				.getSourceFileNames()
				.filter((path) => path.startsWith(directory + '/'))
				.map((path) => [path, program.getSourceFile(path)]),
		)
		const local = (path: string) => relative(directory, path).replaceAll('\\', '/')
		const canonicalFiles = new Map([...files.keys()].map((path) => [path.toLowerCase(), path]))
		const target = (file: string, specifier: string, module?: ts.Node) => {
			const resolved =
				module &&
				checker
					.getSymbolAtLocation(module)
					?.declarations.map((declaration) =>
						canonicalFiles.get(String(declaration.path).toLowerCase()),
					)
					.find((path) => path !== undefined)
			if (resolved) return resolved
			if (!specifier.startsWith('.')) return undefined
			const path = resolve(dirname(file), specifier)
			return [path, path.replace(/\.js$/, '.ts'), `${path}.ts`, `${path}/index.ts`].find(
				(candidate) => files.has(candidate),
			)
		}
		const entries = new Set<string>()
		for (const [path, source] of files) {
			if (!source || !local(path).startsWith('generated/')) continue
			for (const node of source.statements)
				if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
					const found = target(path, node.moduleSpecifier.text, node.moduleSpecifier)
					if (found && local(found).startsWith('features/')) entries.add(found)
				}
		}
		type Role = 'application' | 'adapter' | 'http' | 'runtime' | 'host'
		const role = (path: string): Role => {
			const name = local(path)
			if (name.startsWith('runtime/')) return 'runtime'
			if (entries.has(path) || /\/http(?:-errors)?\.ts$/.test(name)) return 'http'
			if (
				name.startsWith('contract/') ||
				['index.ts', 'http.ts', 'auth.ts', 'proxy.ts', 'env.ts'].includes(name)
			)
				return 'host'
			if (
				/^features\/[^/]+\/(repository|provider|stripe|r2)\.ts$/.test(name) ||
				['persistence.ts', 'identity-crypto.ts'].includes(name)
			)
				return 'adapter'
			return 'application'
		}
		const feature = (path: string) => /^features\/([^/]+)\//.exec(local(path))?.[1]
		const graph = new Map<string, Set<string>>()
		const d1 = (type: Type | undefined, visited = new Set<number>()): boolean => {
			if (!type || visited.has(type.id)) return false
			visited.add(type.id)
			return (
				type.getSymbol()?.name === 'D1Database' ||
				type.getAliasTypeArguments().some((argument) => d1(argument, visited)) ||
				(type.isTypeParameter() && d1(checker.getConstraintOfTypeParameter(type), visited)) ||
				((type.isUnionType() || type.isIntersectionType()) &&
					type.getTypes().some((member) => d1(member, visited))) ||
				(type.getBaseTypes()?.some((base) => d1(base, visited)) ?? false)
			)
		}
		for (const entry of readdirSync(directory, { withFileTypes: true }))
			if (
				entry.isDirectory() &&
				!['features', 'runtime', 'contract', 'generated'].includes(entry.name)
			)
				errors.push(
					`${entry.name}/: keep capabilities in features/, not top-level technical folders`,
				)
		for (const [path, source] of files) {
			if (!source || local(path).startsWith('generated/')) continue
			const kind = role(path)
			const restrictedEffect = (name: string) =>
				(kind !== 'host' &&
					['runPromise', 'runPromiseExit', 'runSync', 'runSyncExit', 'runFork'].includes(name)) ||
				((kind === 'application' || kind === 'http') && ['tryPromise', 'promise'].includes(name))
			const edges = new Set<string>()
			graph.set(path, edges)
			const fail = (node: ts.Node, message: string) =>
				errors.push(
					`${local(path)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`,
				)
			const dependency = (node: ts.Node, specifier: string, typeOnly: boolean) => {
				const module =
					ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
						? node.moduleSpecifier
						: ts.isCallExpression(node)
							? node.arguments[0]
							: undefined
				const imported = target(path, specifier, module)
				if (imported) {
					edges.add(imported)
					const importedRole = role(imported)
					if (
						kind === 'application' &&
						importedRole !== 'application' &&
						!(typeOnly && local(imported) === 'persistence.ts')
					)
						fail(
							node,
							'application code must depend on contracts, not adapters, runtime composition or HTTP',
						)
					if (
						kind === 'adapter' &&
						['http', 'host', 'runtime'].includes(importedRole) &&
						!(typeOnly && local(imported) === 'env.ts')
					)
						fail(node, 'infrastructure adapters must not depend on HTTP or runtime composition')
					if (kind === 'http' && importedRole === 'adapter')
						fail(node, 'HTTP handlers obtain adapters through runtime Layers')
					if (
						feature(path) &&
						feature(imported) &&
						feature(path) !== feature(imported) &&
						!/\/(service|domain)\.ts$|\/domain\//.test(imported) &&
						!(kind === 'http' && importedRole === 'http')
					)
						fail(node, 'cross-feature imports must use service/domain contracts')
				} else if (
					kind === 'application' &&
					![
						'effect',
						'@workspace/contracts',
						'@workspace/contracts/values',
						'@workspace/contracts/todos',
					].includes(specifier)
				) {
					fail(node, `application dependency ${specifier} is not a pure public contract`)
				}
			}
			const visit = (node: ts.Node): void => {
				if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
					dependency(
						node,
						node.moduleSpecifier.text,
						node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword,
					)
				if (ts.isImportSpecifier(node) && restrictedEffect((node.propertyName ?? node.name).text))
					fail(node, 'execute Effects at hosts and adapt promises at infrastructure boundaries')
				if (
					ts.isExportDeclaration(node) &&
					node.moduleSpecifier &&
					ts.isStringLiteral(node.moduleSpecifier)
				)
					dependency(node, node.moduleSpecifier.text, node.isTypeOnly)
				if (
					ts.isCallExpression(node) &&
					(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
						(ts.isIdentifier(node.expression) && node.expression.text === 'require'))
				) {
					const specifier = node.arguments[0]
					if (specifier && ts.isStringLiteral(specifier)) dependency(node, specifier.text, false)
					else fail(node, 'dynamic module specifiers hide dependencies')
				}
				if (
					kind === 'application' &&
					ts.isIdentifier(node) &&
					['fetch', 'process', 'Date', 'Promise', 'crypto', 'globalThis'].includes(node.text)
				) {
					const symbol = checker.getSymbolAtLocation(node)
					if (
						!symbol ||
						symbol.declarations.length === 0 ||
						symbol.declarations.some(
							(declaration) =>
								!String(declaration.path)
									.toLowerCase()
									.startsWith(directory.toLowerCase() + '/'),
						)
					)
						fail(node, 'ambient I/O and time belong in injected services or adapters')
				}
				if (
					(ts.isAsExpression(node) || ts.isTypeAssertion(node)) &&
					node.type.getText(source) !== 'const' &&
					!(local(path) === 'contract/service.ts' && node.type.getText(source) === 'FailureOf<O>')
				)
					fail(node, 'decode or narrow values instead of asserting their type')
				if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
					const name = ts.isPropertyAccessExpression(node)
						? node.name.text
						: node.argumentExpression && ts.isStringLiteral(node.argumentExpression)
							? node.argumentExpression.text
							: undefined
					if (
						name &&
						['prepare', 'exec', 'batch'].includes(name) &&
						d1(checker.getTypeAtLocation(node.expression))
					)
						fail(node, 'direct D1 persistence must use the matching Drizzle client')
					if (name && restrictedEffect(name))
						fail(node, 'execute Effects at hosts and adapt promises at infrastructure boundaries')
				}
				if (
					(ts.isVariableDeclaration(node) || ts.isParameterDeclaration(node)) &&
					ts.isObjectBindingPattern(node.name)
				) {
					for (const element of node.name.elements) {
						const name = element.propertyName ?? element.name
						if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
							if (
								['prepare', 'exec', 'batch'].includes(name.text) &&
								d1(checker.getTypeAtLocation(node.name))
							)
								fail(element, 'direct D1 persistence must use the matching Drizzle client')
							if (restrictedEffect(name.text))
								fail(
									element,
									'execute Effects at hosts and adapt promises at infrastructure boundaries',
								)
						}
					}
				}
				if ((kind === 'application' || kind === 'http') && node.kind === ts.SyntaxKind.AsyncKeyword)
					fail(node, 'compose Effect workflows; keep async callbacks in infrastructure adapters')
				node.forEachChild(visit)
			}
			visit(source)
			if (/\b(?:oxlint|eslint)-disable|@ts-(?:ignore|nocheck|expect-error)\b/.test(source.text))
				errors.push(`${local(path)}: do not suppress architecture/type checks`)
		}
		const visiting = new Set<string>(),
			visited = new Set<string>()
		const walk = (path: string, stack: string[]) => {
			if (visiting.has(path)) {
				errors.push(
					`dependency cycle: ${[...stack.slice(stack.indexOf(path)), path].map(local).join(' -> ')}`,
				)
				return
			}
			if (visited.has(path)) return
			visiting.add(path)
			for (const child of graph.get(path) ?? []) if (graph.has(child)) walk(child, [...stack, path])
			visiting.delete(path)
			visited.add(path)
		}
		for (const path of graph.keys()) walk(path, [])
		snapshot.dispose()
	} finally {
		api.close()
	}
	return errors
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const root = fileURLToPath(new URL('..', import.meta.url))
	if (!existsSync(resolve(root, 'apps/api/tsconfig.json'))) throw new Error('API project missing')
	const errors = checkArchitecture(root)
	if (errors.length) {
		console.error(errors.join('\n'))
		process.exitCode = 1
	} else console.log('Backend architecture boundaries and dependency graph pass.')
}
