import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useHydrated } from './use-hydrated'
import { paymentPolling } from '../lib/payment-polling'

export function usePaymentStatus<T>(
	scope: string,
	sessionId: string,
	load: () => Promise<T>,
	processing: (data: T) => boolean,
) {
	const hydrated = useHydrated()
	const [interval] = useState(paymentPolling)
	return useQuery({
		queryKey: [scope, sessionId],
		enabled: hydrated && Boolean(sessionId),
		retry: false,
		queryFn: load,
		refetchInterval: (query) =>
			interval(
				`${scope}:${sessionId}`,
				query.state.data !== undefined && processing(query.state.data),
				Date.now(),
			),
	})
}
