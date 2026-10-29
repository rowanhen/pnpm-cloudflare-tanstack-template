import { useRouter } from '@tanstack/react-router'
import { resetUser } from '@workspace/observability/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useHydrated } from '@workspace/shared'
import { authRequest } from '../lib/auth-request'
import { listFiles } from '../generated/files'
import { useListTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../generated/todos'
import type { TodosResponse } from '../generated/api.schemas'

export function useWorkspace(userId: string) {
	const hydrated = useHydrated()
	const client = useQueryClient()
	const todos = useListTodos<TodosResponse>({
		query: {
			queryKey: ['todos', userId],
			select: (response) => response.data,
			retry: false,
		},
	})
	const files = useQuery({
		queryKey: ['files', userId],
		queryFn: async () => (await listFiles()).data,
		retry: false,
	})
	const mutation = useMutation({
		mutationFn: async (action: () => Promise<unknown>) => action(),
		onSuccess: async () => {
			await client.invalidateQueries()
		},
	})
	const onSuccess = async () => {
		await client.invalidateQueries()
	}
	const createTodo = useCreateTodo({ mutation: { onSuccess } })
	const updateTodo = useUpdateTodo({ mutation: { onSuccess } })
	const deleteTodo = useDeleteTodo({ mutation: { onSuccess } })
	const latestMutation = [mutation, createTodo, updateTodo, deleteTodo].reduce((latest, current) =>
		current.submittedAt > latest.submittedAt ? current : latest,
	)
	return {
		todos,
		files,
		mutation,
		todoMutations: { create: createTodo, update: updateTodo, delete: deleteTodo },
		busy:
			!hydrated ||
			mutation.isPending ||
			createTodo.isPending ||
			updateTodo.isPending ||
			deleteTodo.isPending,
		error: latestMutation.error ?? todos.error ?? files.error,
	}
}
export function useSignOut() {
	const router = useRouter()
	const client = useQueryClient()
	return useMutation({
		mutationFn: async () => {
			await authRequest('/api/auth/sign-out', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}',
			})
			resetUser()
			client.clear()
			await router.invalidate()
			await router.navigate({ to: '/login', search: {} })
		},
	})
}
