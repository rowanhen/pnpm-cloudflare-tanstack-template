// A manual refresh does not extend automatic verification. Each mounted session gets one window.
export function paymentPolling() {
	let deadline: number | undefined
	let session: string | undefined
	return (key: string, processing: boolean, now: number): number | false => {
		if (key !== session) {
			session = key
			deadline = undefined
		}
		if (!processing) return false
		deadline ??= now + 30_000
		return now < deadline ? Math.min(2500, deadline - now) : false
	}
}
