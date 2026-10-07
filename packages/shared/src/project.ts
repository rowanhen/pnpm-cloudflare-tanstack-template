export const PROJECT_NAME = 'pnpm-cloudflare-tanstack-template'

export function appTitle(section: string) {
	return `${section} | ${PROJECT_NAME}`
}

export function appMetaDescription(audience: string) {
	return `${PROJECT_NAME} ${audience} app powered by TanStack Start, Cloudflare D1, R2, and pnpm.`
}
