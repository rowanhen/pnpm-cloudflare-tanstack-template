export function money(amount: number, currency: string) {
	const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency })
	return format.format(priceAmount(amount, currency))
}

export function priceAmount(amount: number, currency: string) {
	const digits = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).resolvedOptions()
		.maximumFractionDigits
	return amount / 10 ** (digits ?? 2)
}
