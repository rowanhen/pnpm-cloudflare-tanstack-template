import { createFileRoute } from '@tanstack/react-router'
import { Container, Section, Stack, Typography } from '@leitware/composables'
import { AnchorButton } from '@workspace/shared'
import { t } from '@workspace/shared/lib/i18n'
import { repository, seo, site } from '../../../../lib/seo'
import { MarketingFooter } from '../../../-components/footer'
import { MarketingHeader } from '../../../-components/header'

type GuideCopy = (typeof import('./-copy/en'))['default']
const translations = import.meta.glob<{ default: GuideCopy }>('./-copy/*.ts')

export const Route = createFileRoute('/$locale/guides/getting-started/')({
	loader: ({ params }) => t(translations, params.locale),
	head: ({ loaderData, params }) => {
		if (!loaderData) return {}
		return seo(
			`/${params.locale}/guides/getting-started`,
			loaderData.seoTitle,
			loaderData.seoDescription,
			false,
			true,
		)
	},
	component: GettingStartedPage,
})

function GettingStartedPage() {
	const copy = Route.useLoaderData()
	const { locale } = Route.useParams()
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		name: copy.seoTitle,
		headline: copy.title,
		description: copy.seoDescription,
		url: `${site.url}/${locale}/guides/getting-started`,
	}

	return (
		<div className="min-h-svh">
			<Container maxWidth="md">
				<MarketingHeader />
				<main>
					<div className="mx-auto max-w-2xl">
						<header className="py-16">
							<Stack gap={8}>
								<Typography as="h1" variant="hero-300">
									{copy.title}
								</Typography>
								<Typography
									as="p"
									variant="body-300"
									className="max-w-xl leading-7 text-content-secondary"
								>
									{copy.intro}
								</Typography>
							</Stack>
						</header>
						<Section spacing="lg" id="local" aria-labelledby="local-title" className="border-t">
							<Stack gap={8}>
								<Typography as="h2" variant="heading-400" id="local-title">
									{copy.localTitle}
								</Typography>
								<ol className="space-y-3 pl-6 list-decimal">
									{copy.localSteps.map((step) => (
										<li key={step}>
											<Typography as="p" variant="body-200">
												{step}
											</Typography>
										</li>
									))}
								</ol>
							</Stack>
						</Section>
						<Section
							spacing="lg"
							id="providers"
							aria-labelledby="providers-title"
							className="border-t"
						>
							<Stack gap={8}>
								<Typography as="h2" variant="heading-400" id="providers-title">
									{copy.providersTitle}
								</Typography>
								<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
									{copy.providersDescription}
								</Typography>
								<nav aria-label={copy.nextStepsLabel} className="grid gap-4">
									<AnchorButton
										href={`${repository}/blob/main/docs/getting-started.md`}
										variant="link"
									>
										{copy.setupLinkLabel}
									</AnchorButton>
								</nav>
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
