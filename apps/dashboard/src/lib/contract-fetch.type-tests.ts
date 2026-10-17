import type { GetTodoQueryError } from '../generated/todos'
import { ApiError } from './contract-fetch'

function checkError(error: GetTodoQueryError) {
	if (error instanceof ApiError && error.response.status === 404) {
		const code: 'todo_not_found' = error.response.data.code
		// @ts-expect-error Generated status narrowing rules out a forbidden body on 404.
		const forbidden: 'forbidden' = error.response.data.code
		void [code, forbidden]
	}
}
void checkError
