import { createFileRoute } from '@tanstack/react-router'
import { Container, Section, Stack, Typography } from '@leitware/composables'
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
			<Container maxWidth="md">
				<MarketingHeader />
				<main>
					<div className="mx-auto max-w-2xl">
						<header className="py-16">
							<Typography as="h1" variant="hero-300">
								{copy.title}
							</Typography>
						</header>
						<Section spacing="lg" id="privacy" aria-labelledby="privacy-title" className="border-t">
							<Stack gap={8}>
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
							</Stack>
						</Section>
						<script
							type="application/ld+json"
							dangerouslySetInnerHTML={{
								__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
							}}
						/>
					</div>
				</main>
				<MarketingFooter />
			</Container>
		</div>
	)
}
