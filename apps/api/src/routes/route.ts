import { allowedMethods } from '@workspace/contracts/http'
import generatedApi from '../generated/routes'
import { json, methodNotAllowed } from '../http'
import type { Env } from '../env'
import { Hono } from 'hono'
import { authRoute } from './api/auth'

// The OpenAPI contract generates application routes; Better Auth owns its protocol routes.
const app = new Hono<{ Bindings: Env }>()
app.on(['GET', 'POST'], '/api/auth/*', authRoute)
app.route('/', generatedApi)
app.onError((error) => {
	throw error
})
app.notFound((c) => {
	const methods = allowedMethods(c.req.path)
	return methods.length ? methodNotAllowed(methods.join(', ')) : json({ error: 'Not found' }, 404)
})

export default app
