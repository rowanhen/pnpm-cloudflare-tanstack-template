import { createAuth } from '../../auth'
import { HttpError } from '../../http'
import type { Env } from '../../env'
import type { Context } from 'hono'

export function authRoute(c: Context<{ Bindings: Env }>) {
	if (!c.env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
	return createAuth(c.env).handler(c.req.raw)
}
