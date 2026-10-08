export const PROJECT_NAME = 'pnpm-cloudflare-tanstack-template'
export const APP_NAME = 'Cloudflare Starter'

export function appTitle(section: string) {
	return `${section} | ${APP_NAME}`
}

export function appMetaDescription(audience: string) {
	return `${APP_NAME} ${audience}.`
}
