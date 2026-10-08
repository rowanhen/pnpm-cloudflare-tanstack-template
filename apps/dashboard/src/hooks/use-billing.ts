import { useQuery } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { client } from '../lib/api'

export type { BillingStatus } from '@workspace/contracts'
export function useBilling() {
	const hydrated = useHydrated()
	return useQuery({
		queryKey: ['billing'],
		enabled: hydrated,
		queryFn: () => client.get('billing'),
	})
}
