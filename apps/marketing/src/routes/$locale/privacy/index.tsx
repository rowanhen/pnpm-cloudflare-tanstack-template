import { createFileRoute } from '@tanstack/react-router'
import { Typography } from '@leitware/composables'
import { t } from '@workspace/shared/lib/i18n'
import { seo, site } from '../../../lib/seo'
import { MarketingFooter } from '../../-components/footer'
import { MarketingHeader } from '../../-components/header'

type PrivacyCopy = (typeof import('./-copy/en'))['default']
const translations = import.meta.glob<{ default: PrivacyCopy }>('./-copy/*.ts')

export const Route = createFileRoute('/$locale/privacy/')({
	loader: ({ params }) => t(translations, params.locale),
	head: ({ loaderData, params }) => {
		if (!loaderData) return {}
		return seo(`/${params.locale}/privacy`, loaderData.seoTitle, loaderData.seoDescription)
	},
	component: PrivacyPage,
})

function PrivacyPage() {
	const copy = Route.useLoaderData()
	const { locale } = Route.useParams()
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: copy.seoTitle,
		headline: copy.title,
		description: copy.seoDescription,
		url: `${site.url}/${locale}/privacy`,
	}

	return (
		<div className="min-h-svh">
			<div className="page-container">
				<MarketingHeader />
				<main>
					<div className="mx-auto max-w-2xl">
						<header className="py-16">
							<Typography as="h1" variant="hero-300">
								{copy.title}
							</Typography>
						</header>
						<section id="privacy" aria-labelledby="privacy-title" className="py-24 border-t">
							<div className="flex min-w-0 flex-col gap-8">
								<Typography as="h2" variant="heading-400" id="privacy-title">
									{copy.sectionTitle}
								</Typography>
								{copy.paragraphs.map((paragraph) => (
									<Typography
										key={paragraph}
										as="p"
										variant="body-200"
										className="text-content-secondary leading-7"
									>
										{paragraph}
									</Typography>
								))}
							</div>
						</section>
						<script
							type="application/ld+json"
							dangerouslySetInnerHTML={{
								__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
							}}
						/>
					</div>
				</main>
				<MarketingFooter />
			</div>
		</div>
	)
}
