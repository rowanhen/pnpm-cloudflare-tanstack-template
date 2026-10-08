import { useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { api } from '../lib/api'

export type BillingStatus = {
	balance: number
	summaryCost: number
	packCredits: number
	activity: { id: string; type: string; credits: number; created_at: string }[]
}
export function useBilling() {
	const hydrated = useHydrated()
	return useQuery({
		queryKey: ['billing'],
		enabled: hydrated,
		queryFn: async () => (await (await api('/api/billing')).json()) as BillingStatus,
	})
}
