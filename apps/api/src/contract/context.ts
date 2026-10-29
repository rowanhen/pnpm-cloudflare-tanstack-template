import { Context } from 'effect'
import { productDatabase } from '@workspace/data/client'
import type { Env } from '../env'
import type { User } from '@workspace/contracts'

export class PublicApiRequest extends Context.Service<
	PublicApiRequest,
	{ readonly request: Request; readonly env: Env }
>()('api/PublicRequest') {}

export class ApiRequest extends Context.Service<
	ApiRequest,
	{
		readonly db: ReturnType<typeof productDatabase>
		readonly userId: string
		readonly user: User
		readonly request: Request
		readonly env: Env
	}
>()('api/Request') {}

export class ApiKeyRequest extends Context.Service<
	ApiKeyRequest,
	{
		readonly request: Request
		readonly env: Env
		readonly userId: string
		readonly keyId: string
		readonly headers: Record<string, string>
	}
>()('api/KeyRequest') {}
