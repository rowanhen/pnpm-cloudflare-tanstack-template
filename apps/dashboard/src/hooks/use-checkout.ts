import { useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { getConfig } from '../generated/system'
import { getCheckoutConfig, createCheckout, getOrder } from '../generated/checkout'

export type { CheckoutConfig, CheckoutSession, OrderStatus } from '@workspace/contracts'
export function money(amount: number, currency: string) {
	const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency })
	return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
}
export function useCheckoutSession() {
	const navigate = useNavigate()
	const hydrated = useHydrated()
	const requestId = useRef<string | null>(null)
	const availability = useQuery({
		queryKey: ['app-config'],
		enabled: hydrated,
		retry: false,
		queryFn: async () => (await getConfig()).data,
	})
	const config = useQuery({
		queryKey: ['checkout-config'],
		enabled: hydrated && availability.data?.checkoutEnabled === true,
		retry: false,
		queryFn: async () => (await getCheckoutConfig()).data,
	})
	const create = useMutation({
		mutationFn: async () => {
			requestId.current ??= crypto.randomUUID()
			const { data: session } = await createCheckout({ requestId: requestId.current })
			if (session.status !== 'open')
				await navigate({ to: '/checkout/success', search: { session_id: session.sessionId } })
			return session
		},
	})
	return { availability, config, create }
}
export function useOrderStatus(sessionId: string) {
	const hydrated = useHydrated()
	return useQuery({
		queryKey: ['order', sessionId],
		enabled: hydrated && Boolean(sessionId),
		retry: false,
		queryFn: async () => (await getOrder(sessionId)).data,
		refetchInterval: (query) =>
			query.state.data?.order.status === 'pending' &&
			query.state.data.checkoutStatus === 'complete' &&
			query.state.dataUpdateCount < 12
				? 2500
				: false,
	})
}
