import { Context } from 'effect'
import { database } from '@workspace/data/client'

export class ApiRequest extends Context.Service<
	ApiRequest,
	{
		readonly db: ReturnType<typeof database>
		readonly userId: string
	}
>()('api/Request') {}
