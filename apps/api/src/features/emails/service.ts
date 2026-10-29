import { Context, type Effect } from 'effect'
import type { EmailStatusData } from '@workspace/contracts/values'
import type { User } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import type { ApplicationError, ProviderFailure, Unavailable } from '../../errors'
import type { Mail, AcceptedMail, DeliveryState, Settlement } from './domain'
export class EmailRepository extends Context.Service<
	EmailRepository,
	{
		readonly reserve: (
			mail: Mail,
		) => Effect.Effect<
			{ kind: 'fresh'; id: string } | { kind: 'existing'; state: DeliveryState },
			StorageError
		>
		readonly settle: (
			id: string,
			settlement: Settlement,
			millis: number,
		) => Effect.Effect<void, StorageError>
		readonly list: (userId: string) => Effect.Effect<typeof EmailStatusData.Type, StorageError>
	}
>()('emails/Repository') {}
export class EmailProvider extends Context.Service<
	EmailProvider,
	{
		readonly enabled: boolean
		readonly send: (
			to: string,
			template: Mail['template'],
		) => Effect.Effect<string, ProviderFailure | Unavailable>
	}
>()('emails/Provider') {}
export class EmailService extends Context.Service<
	EmailService,
	{
		readonly status: (
			userId: string,
		) => Effect.Effect<{ enabled: boolean; emails: typeof EmailStatusData.Type }, StorageError>
		readonly confirm: (
			email: string,
			entryId: string,
		) => Effect.Effect<void, ApplicationError | StorageError>
		readonly test: (
			user: User,
			requestId: string,
		) => Effect.Effect<AcceptedMail, ApplicationError | StorageError>
	}
>()('emails/Service') {}
