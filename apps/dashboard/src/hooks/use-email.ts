import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { getEmailStatus, sendTestEmail } from '../generated/emails'

export function useEmail() {
	const hydrated = useHydrated()
	const queries = useQueryClient()
	const requestId = useRef<string | null>(null)
	const status = useQuery({
		queryKey: ['email'],
		enabled: hydrated,
		queryFn: async () => (await getEmailStatus()).data,
	})
	const send = useMutation({
		mutationFn: () => {
			requestId.current ??= crypto.randomUUID()
			return sendTestEmail({ requestId: requestId.current }).then((response) => response.data)
		},
		onSuccess: () => {
			requestId.current = null
		},
		onSettled: () => queries.invalidateQueries({ queryKey: ['email'] }),
	})
	return { status, send, disabled: !hydrated || !status.data?.enabled || send.isPending }
}
