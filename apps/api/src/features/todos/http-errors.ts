import { InvalidInput, MissingRecord } from '../../errors'
import type { StorageError } from '../../persistence'
import type { InvalidTodo, TodoNotFound } from './todos'

// Keep Todo failures independent of transport; the shared responder owns HTTP codes and bodies.
export function todoError(error: InvalidTodo | TodoNotFound | StorageError) {
	switch (error._tag) {
		case 'InvalidTodo':
			return new InvalidInput({ message: 'Invalid todo' })
		case 'TodoNotFound':
			return new MissingRecord({ message: 'Todo not found' })
		case 'StorageError':
			return error
	}
}
