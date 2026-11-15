// Keep return destinations explicit: never redirect to a URL supplied by a visitor.
export function checkoutSessionId(value: unknown) {
	return typeof value === 'string' && /^cs_test_[A-Za-z0-9]{1,240}$/.test(value) ? value : ''
}
