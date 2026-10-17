// Generated from openapi/features by scripts/generate-api.ts. Do not edit.

import { Schema } from 'effect'
import type { Handler, InputOf, SuccessOf, FailureOf } from '../operation'
import * as todosSchemas from './todos.effect'

export const listTodos = {
	operationId: 'listTodos',
	method: 'GET',
	path: '/api/todos',
	hasBody: false,
	input: Schema.Struct({}),
	responses: {
		200: todosSchemas.ListTodos200Response,
		400: todosSchemas.ListTodos400Response,
		401: todosSchemas.ListTodos401Response,
		403: todosSchemas.ListTodos403Response,
		500: todosSchemas.ListTodos500Response,
		503: todosSchemas.ListTodos503Response,
	},
	errorCodes: {
		400: 'bad_request',
		401: 'unauthorized',
		403: 'forbidden',
		500: 'internal_error',
		503: 'unavailable',
	},
} as const
export type ListTodosInput = InputOf<typeof listTodos>
export type ListTodosSuccess = SuccessOf<typeof listTodos>
export type ListTodosFailure = FailureOf<typeof listTodos>
export type ListTodosHandler<R = never> = Handler<typeof listTodos, R>

export const createTodo = {
	operationId: 'createTodo',
	method: 'POST',
	path: '/api/todos',
	hasBody: true,
	input: Schema.Struct({ body: todosSchemas.CreateTodoBody }),
	responses: {
		201: todosSchemas.CreateTodo201Response,
		400: todosSchemas.CreateTodo400Response,
		401: todosSchemas.CreateTodo401Response,
		403: todosSchemas.CreateTodo403Response,
		413: todosSchemas.CreateTodo413Response,
		415: todosSchemas.CreateTodo415Response,
		500: todosSchemas.CreateTodo500Response,
		503: todosSchemas.CreateTodo503Response,
	},
	errorCodes: {
		400: 'bad_request',
		401: 'unauthorized',
		403: 'forbidden',
		413: 'payload_too_large',
		415: 'unsupported_media_type',
		500: 'internal_error',
		503: 'unavailable',
	},
} as const
export type CreateTodoInput = InputOf<typeof createTodo>
export type CreateTodoSuccess = SuccessOf<typeof createTodo>
export type CreateTodoFailure = FailureOf<typeof createTodo>
export type CreateTodoHandler<R = never> = Handler<typeof createTodo, R>

export const getTodo = {
	operationId: 'getTodo',
	method: 'GET',
	path: '/api/todos/{id}',
	hasBody: false,
	input: Schema.Struct({ params: todosSchemas.GetTodoParams }),
	responses: {
		200: todosSchemas.GetTodo200Response,
		400: todosSchemas.GetTodo400Response,
		401: todosSchemas.GetTodo401Response,
		403: todosSchemas.GetTodo403Response,
		404: todosSchemas.GetTodo404Response,
		500: todosSchemas.GetTodo500Response,
		503: todosSchemas.GetTodo503Response,
	},
	errorCodes: {
		400: 'bad_request',
		401: 'unauthorized',
		403: 'forbidden',
		404: 'todo_not_found',
		500: 'internal_error',
		503: 'unavailable',
	},
} as const
export type GetTodoInput = InputOf<typeof getTodo>
export type GetTodoSuccess = SuccessOf<typeof getTodo>
export type GetTodoFailure = FailureOf<typeof getTodo>
export type GetTodoHandler<R = never> = Handler<typeof getTodo, R>

export const updateTodo = {
	operationId: 'updateTodo',
	method: 'PATCH',
	path: '/api/todos/{id}',
	hasBody: true,
	input: Schema.Struct({
		params: todosSchemas.UpdateTodoParams,
		body: todosSchemas.UpdateTodoBody.check(Schema.isMinProperties(1)),
	}),
	responses: {
		200: todosSchemas.UpdateTodo200Response,
		400: todosSchemas.UpdateTodo400Response,
		401: todosSchemas.UpdateTodo401Response,
		403: todosSchemas.UpdateTodo403Response,
		404: todosSchemas.UpdateTodo404Response,
		413: todosSchemas.UpdateTodo413Response,
		415: todosSchemas.UpdateTodo415Response,
		500: todosSchemas.UpdateTodo500Response,
		503: todosSchemas.UpdateTodo503Response,
	},
	errorCodes: {
		400: 'bad_request',
		401: 'unauthorized',
		403: 'forbidden',
		404: 'todo_not_found',
		413: 'payload_too_large',
		415: 'unsupported_media_type',
		500: 'internal_error',
		503: 'unavailable',
	},
} as const
export type UpdateTodoInput = InputOf<typeof updateTodo>
export type UpdateTodoSuccess = SuccessOf<typeof updateTodo>
export type UpdateTodoFailure = FailureOf<typeof updateTodo>
export type UpdateTodoHandler<R = never> = Handler<typeof updateTodo, R>

export const deleteTodo = {
	operationId: 'deleteTodo',
	method: 'DELETE',
	path: '/api/todos/{id}',
	hasBody: false,
	input: Schema.Struct({ params: todosSchemas.DeleteTodoParams }),
	responses: {
		204: Schema.Undefined,
		400: todosSchemas.DeleteTodo400Response,
		401: todosSchemas.DeleteTodo401Response,
		403: todosSchemas.DeleteTodo403Response,
		404: todosSchemas.DeleteTodo404Response,
		500: todosSchemas.DeleteTodo500Response,
		503: todosSchemas.DeleteTodo503Response,
	},
	errorCodes: {
		400: 'bad_request',
		401: 'unauthorized',
		403: 'forbidden',
		404: 'todo_not_found',
		500: 'internal_error',
		503: 'unavailable',
	},
} as const
export type DeleteTodoInput = InputOf<typeof deleteTodo>
export type DeleteTodoSuccess = SuccessOf<typeof deleteTodo>
export type DeleteTodoFailure = FailureOf<typeof deleteTodo>
export type DeleteTodoHandler<R = never> = Handler<typeof deleteTodo, R>

export const operations = [listTodos, createTodo, getTodo, updateTodo, deleteTodo] as const
