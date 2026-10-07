import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { api } from '../lib/api'

type Todo = { id: string; title: string; completed: boolean }
type StoredFile = { key: string; size: number }
export function useWorkspace(userId: string) {
	const hydrated = useHydrated()
	const client = useQueryClient()
	const todos = useQuery({
		queryKey: ['todos', userId],
		queryFn: async () => (await (await api('/api/todos')).json()) as { todos: Todo[] },
		retry: false,
	})
	const files = useQuery({
		queryKey: ['files', userId],
		queryFn: async () =>
			(await (await api('/api/files')).json()) as { files: StoredFile[]; cursor: string | null },
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
			client.clear()
			window.location.assign('/login')
		},
	})
}
