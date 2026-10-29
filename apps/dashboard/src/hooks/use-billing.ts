import { useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { getBilling } from '../generated/billing'

export type { BillingStatus } from '@workspace/contracts'
export function useBilling() {
	const hydrated = useHydrated()
	return useQuery({
		queryKey: ['billing'],
		enabled: hydrated,
		queryFn: async () => (await getBilling()).data,
	})
}
