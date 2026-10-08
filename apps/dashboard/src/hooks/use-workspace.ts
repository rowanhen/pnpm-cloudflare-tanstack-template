import { resetUser } from '@workspace/observability/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { api, client as apiClient } from '../lib/api'

export function useWorkspace(userId: string) {
	const hydrated = useHydrated()
	const client = useQueryClient()
	const todos = useQuery({
		queryKey: ['todos', userId],
		queryFn: () => apiClient.get('todos'),
		retry: false,
	})
	const files = useQuery({
		queryKey: ['files', userId],
		queryFn: () => apiClient.get('files'),
		retry: false,
	})
	const mutation = useMutation({
		mutationFn: async (action: () => Promise<unknown>) => action(),
		onSuccess: async () => {
			await client.invalidateQueries()
		},
	})
	return {
		todos,
		files,
		mutation,
		busy: !hydrated || mutation.isPending,
		error: mutation.error ?? todos.error ?? files.error,
	}
}
export function useSignOut() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async () => {
			await api('/api/auth/sign-out', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}',
			})
			resetUser()
			client.clear()
			window.location.assign('/login')
		},
	})
}
