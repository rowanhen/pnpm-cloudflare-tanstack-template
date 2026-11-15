import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getStorefront as storefrontOperation } from '@workspace/contracts/operations'
import { fetchApi } from '@workspace/shared/server-proxy'
import { Schema } from 'effect'
import { getGetStorefrontQueryKey } from '../generated/storefront'
import { apiTarget } from './proxy.server'

const loadStorefront = createServerFn({ method: 'GET' }).handler(async () => {
	const response = await fetchApi(
		getRequest(),
		storefrontOperation.path,
		{ method: 'GET' },
		apiTarget,
	)
	if (!response.ok) throw new Error('Unable to load test products. Please try again.')
	return Schema.decodeUnknownSync(storefrontOperation.responses[200])(await response.json())
})

export const storefrontOptions = queryOptions({
	queryKey: getGetStorefrontQueryKey(),
	queryFn: () => loadStorefront(),
	staleTime: 30_000,
})
