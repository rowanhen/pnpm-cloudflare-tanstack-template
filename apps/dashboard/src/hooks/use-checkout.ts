import { useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { api } from '../lib/api'

export type CheckoutConfig = {
	publishableKey: string
	offer: { name: string; description: string | null; amount: number; currency: string }
}
export type CheckoutSession = { clientSecret: string | null; sessionId: string; status: string }
export type OrderStatus = {
	order: { id: string; amount: number; currency: string; status: string }
	checkoutStatus: string
}
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
		queryFn: async () => (await (await api('/api/checkout/config')).json()) as CheckoutConfig,
	})
	const create = useMutation({
		mutationFn: async () => {
			requestId.current ??= crypto.randomUUID()
			const session = (await (
				await api('/api/checkout/sessions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ requestId: requestId.current }),
				})
			).json()) as CheckoutSession
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
		queryFn: async () =>
			(await (
				await api(`/api/checkout/sessions/${encodeURIComponent(sessionId)}`)
			).json()) as OrderStatus,
		refetchInterval: (query) =>
			query.state.data?.order.status === 'pending' &&
			query.state.data.checkoutStatus === 'complete' &&
			query.state.dataUpdateCount < 12
				? 2500
				: false,
	})
}
