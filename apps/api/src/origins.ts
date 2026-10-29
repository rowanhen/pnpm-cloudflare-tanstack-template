export const trustedOrigins = (value: string) => [
	...new Set(
		value
			.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean),
	),
]
