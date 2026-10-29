import type { ErrorType as ContractErrorType } from '@workspace/contracts/client'
export type ErrorType<T> = ContractErrorType<T>
import { observedFetch } from '@workspace/observability/browser'
import { createContractFetch } from '@workspace/contracts/client'

const fetchContract = createContractFetch(observedFetch)

// Keep an explicit three-argument mutator signature for Orval's error metadata.
export function contractFetch<T>(
	url: string,
	options: RequestInit = {},
	metadata?: { errorResponses: readonly { status: number; contentType: string }[] },
): Promise<T> {
	return fetchContract<T>(url, options, metadata)
}
