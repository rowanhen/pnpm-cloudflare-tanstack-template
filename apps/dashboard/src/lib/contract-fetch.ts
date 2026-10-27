import { observedFetch, resetUser } from '@workspace/observability/browser'
import { decodeResponse, findOperation } from '@workspace/contracts/http'
import { signInPath } from './login'

export class ApiError<T = unknown> extends Error {
	constructor(
		readonly response: T,
		readonly status: number,
		message: string,
	) {
		super(message)
	}
}
export class TransportError extends Error {}
export class ContractViolation extends Error {}
export type ErrorType<T> = ApiError<T> | TransportError | ContractViolation

export async function contractFetch<T>(
	url: string,
	options: RequestInit = {},
	metadata?: { errorResponses: readonly { status: number; contentType: string }[] },
): Promise<T> {
	const operation = findOperation(
		options.method ?? 'GET',
		new URL(url, 'http://localhost').pathname,
	)
	if (!operation) throw new ContractViolation('No contract for this request')
	let response: Response
	try {
		response = await observedFetch(url, { ...options, credentials: 'same-origin' })
	} catch (cause) {
		throw new TransportError('Unable to reach the API', { cause })
	}
	let data: unknown
	try {
		if (
			response.status !== 204 &&
			!response.headers.get('content-type')?.includes('application/json')
		)
			throw new Error('Expected a JSON response')
		const body: unknown = response.status === 204 ? undefined : await response.json()
		data = decodeResponse(operation, response.status, body)
	} catch (cause) {
		throw new ContractViolation('The API response does not match its contract', { cause })
	}
	const envelope = { data, status: response.status, headers: response.headers }
	if (!response.ok) {
		if (!metadata?.errorResponses.some((error) => error.status === response.status))
			throw new ContractViolation(`Undeclared API error status ${response.status}`)
		if (response.status === 401 && typeof window !== 'undefined') {
			resetUser()
			window.location.assign(
				signInPath(
					window.location.pathname,
					Object.fromEntries(new URLSearchParams(window.location.search)),
				),
			)
		}
		const message =
			typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
				? data.error
				: `Request failed (${response.status})`
		throw new ApiError(envelope, response.status, message)
	}
	// The status/body pair was checked against the same OpenAPI source that generates T.
	return envelope as T
}
