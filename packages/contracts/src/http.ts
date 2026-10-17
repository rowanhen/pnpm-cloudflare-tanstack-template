import { Schema } from 'effect'
import type { Operation } from './operation'
import { operations } from './generated/operations'

const routes = operations.map((operation) => ({
	operation,
	pattern: new RegExp(
		`^${operation.path
			.split(/(\{[^}]+\})/)
			.map((part) => (part.startsWith('{') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
			.join('')}$`,
	),
}))

export function findOperation(method: string, pathname: string): Operation | undefined {
	return routes.find(
		({ operation, pattern }) => operation.method === method.toUpperCase() && pattern.test(pathname),
	)?.operation
}

export function allowedMethods(pathname: string): string[] {
	return routes
		.filter(({ pattern }) => pattern.test(pathname))
		.map(({ operation }) => operation.method)
}

export function decodeResponse(operation: Operation, status: number, body: unknown): unknown {
	const schema = operation.responses[status]
	if (!schema) throw new Error(`${operation.operationId}: undeclared HTTP status ${status}`)
	return Schema.decodeUnknownSync(schema, { onExcessProperty: 'error' })(body)
}

export function contractResponse(operation: Operation, status: number, body: unknown): Response {
	const value = decodeResponse(operation, status, body)
	return status === 204 ? new Response(null, { status }) : Response.json(value, { status })
}

// Middleware failures use the operation's declared schema, just like business failures.
export function contractError(operation: Operation, status: number, message: string): Response {
	return contractResponse(operation, status, { code: operation.errorCodes[status], error: message })
}
