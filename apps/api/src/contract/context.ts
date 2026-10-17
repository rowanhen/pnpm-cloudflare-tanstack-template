import { Context } from 'effect'
import { database } from '@workspace/data/client'
import type { Env } from '../env'

export class PublicApiRequest extends Context.Service<
	PublicApiRequest,
	{ readonly request: Request; readonly env: Env }
>()('api/PublicRequest') {}

export class ApiRequest extends Context.Service<
	ApiRequest,
	{
		readonly db: ReturnType<typeof database>
		readonly userId: string
	}
>()('api/Request') {}
