export const site = {
	name: import.meta.env.VITE_SITE_NAME ?? 'Idea Starter',
	description: 'A private workspace for your next idea. Join the waitlist for early access.',
	url: (import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
	dashboard: import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001',
}
export const indexable =
	import.meta.env.VITE_NOINDEX !== 'true' &&
	!['localhost', '127.0.0.1'].includes(new URL(site.url).hostname)
export function seo(
	path = '/',
	title = `${site.name} — Join the waitlist`,
	description = site.description,
) {
	const url = `${site.url}${path}`
	return {
		meta: [
			{ title },
			{ name: 'description', content: description },
			{ name: 'robots', content: indexable ? 'index, follow' : 'noindex, nofollow' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: site.name },
			{ property: 'og:title', content: title },
			{ property: 'og:description', content: description },
			{ property: 'og:url', content: url },
			{ property: 'og:image', content: `${site.url}/og.png` },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ property: 'og:image:alt', content: `${site.name} — From idea to first signup` },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:title', content: title },
			{ name: 'twitter:description', content: description },
			{ name: 'twitter:image', content: `${site.url}/og.png` },
		],
		links: [{ rel: 'canonical', href: url }],
	}
}
