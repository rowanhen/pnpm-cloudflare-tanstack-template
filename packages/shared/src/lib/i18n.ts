export const defaultLocale = 'en'

export async function t<T>(
	translations: Record<string, () => Promise<{ default: T }>>,
	locale: string,
	fallbackLocale = defaultLocale,
): Promise<T> {
	const find = (code: string) =>
		Object.entries(translations).find(([path]) => path.endsWith(`/${code}.ts`))?.[1]
	const load = find(locale) ?? find(fallbackLocale)
	if (!load) throw new Error(`Missing fallback translation: ${fallbackLocale}`)
	return (await load()).default
}
