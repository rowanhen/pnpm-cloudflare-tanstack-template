import { inputs, mutations, routes, type Input, type Responses } from './index'
type Transport = (path: string, init?: RequestInit) => Promise<Response>

// JSON is the single serialization boundary. Both producers (reply) and consumers
// use the same contract; external/untrusted request bodies are validated with Zod.
async function decode<K extends keyof Responses>(response: Response): Promise<Responses[K]> {
	return response.json()
}
export function createClient(transport: Transport) {
	return {
		async get<K extends keyof typeof routes>(route: K) {
			return decode<K>(await transport(routes[route]))
		},
		async mutate<K extends keyof typeof mutations>(route: K, body: Input<K>) {
			const parsed = inputs[route].parse(body)
			const config = mutations[route]
			return decode<(typeof mutations)[K]['response']>(
				await transport(config.path, {
					method: config.method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(parsed),
				}),
			)
		},
		async updateTodo(id: string, body: Input<'updateTodo'>) {
			return decode<'todo'>(
				await transport(`/api/todos/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(inputs.updateTodo.parse(body)),
				}),
			)
		},
		async order(sessionId: string) {
			return decode<'order'>(
				await transport(`/api/checkout/sessions/${encodeURIComponent(sessionId)}`),
			)
		},
		async deleteTodo(id: string) {
			await transport(`/api/todos/${encodeURIComponent(id)}`, { method: 'DELETE' })
		},
		async deleteKey(id: string) {
			await transport(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
		},
	}
}
