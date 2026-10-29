import {
	createTodo,
	updateTodo,
	getTodo,
	listTodos,
	listTodos200ResponseTodosMax,
} from './generated/todos.effect'

export const CreateTodoData = createTodo.input.fields.body
export const UpdateTodoData = updateTodo.input.fields.body
export const TodoData = getTodo.responses[200].fields.todo
export const TodoListData = listTodos.responses[200].fields.todos

export const TodoListLimit = listTodos200ResponseTodosMax
