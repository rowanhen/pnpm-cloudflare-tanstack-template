import { Cause, Effect } from 'effect'

/** Typed recovery must not erase interruption when a cause also contains a provider failure. */
export function fatalCause(cause: Cause.Cause<unknown>): Cause.Cause<never> | undefined {
	if (!Cause.hasInterrupts(cause) && !Cause.hasDies(cause)) return
	return Cause.fromReasons(
		cause.reasons.map((reason) =>
			Cause.isFailReason(reason) ? Cause.makeDieReason(reason.error) : reason,
		),
	)
}

/** Effect recovery must only handle ordinary typed failures, never a mixed fatal cause. */
export const preserveFatal = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(Effect.catchCause((cause) => Effect.failCause(fatalCause(cause) ?? cause)))
