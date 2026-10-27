import { createServerFn } from '@tanstack/react-start'
import { findPage } from './catalog.server'

export const getPage = createServerFn({ method: 'GET' })
	.validator((path: unknown) => {
		if (typeof path !== 'string') throw new Error('Expected a page path')
		return path
	})
	.handler(({ data }) => findPage(data))
