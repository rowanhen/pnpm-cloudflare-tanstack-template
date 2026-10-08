import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { client } from '../lib/api'

export function useEmail() {
	const hydrated = useHydrated()
	const queries = useQueryClient()
	const requestId = useRef<string | null>(null)
	const status = useQuery({
		queryKey: ['email'],
		enabled: hydrated,
		queryFn: () => client.get('emailStatus'),
	})
	const send = useMutation({
		mutationFn: () => {
			requestId.current ??= crypto.randomUUID()
			return client.mutate('sendEmail', { requestId: requestId.current })
		},
		onSuccess: () => {
			requestId.current = null
		},
		onSettled: () => queries.invalidateQueries({ queryKey: ['email'] }),
	})
	return { status, send, disabled: !hydrated || !status.data?.enabled || send.isPending }
}
