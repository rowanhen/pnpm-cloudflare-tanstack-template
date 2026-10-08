import { useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { client } from '../lib/api'

export type { CheckoutConfig, CheckoutSession, OrderStatus } from '@workspace/contracts'
export function money(amount: number, currency: string) {
	const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency })
	return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
}
export function useCheckoutSession() {
	const hydrated = useHydrated()
	const requestId = useRef<string | null>(null)
	const config = useQuery({
		queryKey: ['checkout-config'],
		enabled: hydrated,
		retry: false,
		queryFn: () => client.get('checkoutConfig'),
	})
	const create = useMutation({
		mutationFn: async () => {
			requestId.current ??= crypto.randomUUID()
			const session = await client.mutate('createCheckout', { requestId: requestId.current })
			if (session.status !== 'open')
				window.location.assign(
					`/checkout/success?session_id=${encodeURIComponent(session.sessionId)}`,
				)
			return session
		},
	})
	return { config, create }
}
export function useOrderStatus(sessionId: string) {
	const hydrated = useHydrated()
	return useQuery({
		queryKey: ['order', sessionId],
		enabled: hydrated && Boolean(sessionId),
		retry: false,
		queryFn: () => client.order(sessionId),
		refetchInterval: (query) =>
			query.state.data?.order.status === 'pending' &&
			query.state.data.checkoutStatus === 'complete' &&
			query.state.dataUpdateCount < 12
				? 2500
				: false,
	})
}
