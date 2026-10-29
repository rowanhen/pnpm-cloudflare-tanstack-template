import { Effect, Layer } from 'effect'
import { todos } from '@workspace/data/product'
import { productDatabase } from '@workspace/data/client'
import { and, eq, count, sum } from 'drizzle-orm'
import { decodeStored, storageEffect, StorageError } from '../../persistence'
import { SummaryResult, SummaryCounts } from './domain'
import { SummaryRepository } from './service'
export const summaryRepositoryLayer = (
	binding: Parameters<typeof productDatabase>[0],
	userId: string,
) => {
	const db = productDatabase(binding)
	return Layer.succeed(SummaryRepository, {
		decodeReplay: (value) =>
			Effect.try({
				try: (): unknown => JSON.parse(value),
				catch: (cause) => new StorageError({ cause }),
			}).pipe(Effect.flatMap((raw) => decodeStored(SummaryResult, raw))),
		snapshot: (status) =>
			storageEffect(() =>
				db
					.select({ total: count(), completed: sum(todos.completed) })
					.from(todos)
					.where(
						and(
							eq(todos.user_id, userId),
							status === 'all' ? undefined : eq(todos.completed, status === 'completed'),
						),
					)
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					decodeStored(SummaryCounts, {
						total: row?.total,
						completed: row?.completed === null ? 0 : Number(row?.completed),
					}),
				),
			),
	})
}
