import { Schema } from 'effect'
import { SummaryData } from '@workspace/contracts/values'
const Count = Schema.Number.check(
	Schema.isInt(),
	Schema.isGreaterThanOrEqualTo(0),
	Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
)
export const SummaryCounts = Schema.Struct({ total: Count, completed: Count }).check(
	Schema.makeFilter((counts) => counts.completed <= counts.total),
)
// Refine the generated DTO with application invariants, including saved replays.
export const SummaryResult = Schema.Struct({
	...SummaryData.fields,
	summary: Schema.Struct({
		...SummaryData.fields.summary.fields,
		...SummaryCounts.fields,
		open: Count,
	}),
}).check(Schema.makeFilter(({ summary }) => summary.total === summary.completed + summary.open))
