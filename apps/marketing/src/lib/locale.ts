import { defaultLocale } from '@workspace/shared/lib/i18n'

export { defaultLocale }
export const supportedLocales = [defaultLocale] as const

export function isSupportedLocale(locale: string): boolean {
	return supportedLocales.some((supported) => supported === locale)
}
