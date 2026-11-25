import { createFileRoute } from '@tanstack/react-router'
import { Badge, CodeBlock, Card, Typography } from '@leitware/composables'
import { AnchorButton, LinkButton, useHydrated } from '@workspace/shared'
import { track } from '@workspace/observability/browser'
import { t } from '@workspace/shared/lib/i18n'
import { repository, seo, site } from '../../lib/seo'
import { MarketingFooter } from '../-components/footer'
import { MarketingHeader } from '../-components/header'
import { WaitlistForm } from './-waitlist-form'

type HomeCopy = (typeof import('./-copy/en'))['default']
const translations = import.meta.glob<{ default: HomeCopy }>('./-copy/*.ts')

export const Route = createFileRoute('/$locale/')({
	loader: ({ params }) => t(translations, params.locale),
	head: ({ loaderData, params }) => {
		if (!loaderData) return {}
		const head = seo(`/${params.locale}`, loaderData.seoTitle, loaderData.seoDescription)
		return {
			...head,
			links: [
				...head.links,
				{ rel: 'alternate', type: 'text/markdown', href: `/${params.locale}/index.md` },
			],
		}
	},
	component: HomePage,
})

function HomePage() {
	const copy = Route.useLoaderData()
	const { locale } = Route.useParams()
	const hydrated = useHydrated()
	const commands = [
		{ label: copy.clone, value: `git clone ${repository}.git my-idea` },
		{ label: copy.install, value: 'cd my-idea && corepack enable && pnpm install' },
		{ label: copy.run, value: 'pnpm dev' },
	]
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: copy.seoTitle,
		headline: `${copy.title} ${copy.accent}`,
		description: copy.seoDescription,
		url: `${site.url}/${locale}`,
	}

	return (
		<div className="min-h-svh">
			<div className="page-container">
				<MarketingHeader />
				<main>
					<header className="py-16">
						<div className="flex min-w-0 flex-col gap-8">
							<Badge variant="outline">{copy.eyebrow}</Badge>
							<Typography as="h1" variant="hero-300">
								{copy.title}
								<br />
								<Typography as="span" variant="hero-300" className="text-brand">
									{copy.accent}
								</Typography>
							</Typography>
							<Typography
								as="p"
								variant="body-300"
								className="max-w-xl leading-7 text-content-secondary"
							>
								{copy.intro}
							</Typography>
							<div className="flex flex-wrap gap-3">
								<AnchorButton
									variant="primary"
									href={`${repository}/generate`}
									size="lg"
									onClick={() => track('template.opened', {})}
								>
									{copy.templateAction}
								</AnchorButton>
								<LinkButton to="." hash="examples" variant="default" size="lg">
									{copy.exploreExamples}
								</LinkButton>
							</div>
						</div>
					</header>
					<section id="setup" aria-labelledby="setup-title" className="py-24 border-t">
						<div className="flex min-w-0 flex-col gap-8">
							<Typography as="h2" variant="heading-400" id="setup-title">
								{copy.setupTitle}
							</Typography>
							<Card
								footer={
									<Typography as="p" variant="caption-100">
										{copy.setupNote}
									</Typography>
								}
							>
								<ol className="space-y-6">
									{commands.map((command) => (
										<li key={command.label} className="space-y-2">
											<CodeBlock
												title={command.label}
												lineNumbers={false}
												showCopyButton={hydrated}
											>
												{command.value}
											</CodeBlock>
										</li>
									))}
								</ol>
							</Card>
							<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
								{copy.stack}
							</Typography>
						</div>
					</section>
					<section id="included" aria-labelledby="included-title" className="py-24 border-t">
						<div className="flex min-w-0 flex-col gap-8">
							<Typography as="h2" variant="heading-400" id="included-title">
								{copy.includedTitle}
							</Typography>
							<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
								{copy.features.map((feature) => (
									<article key={feature.title} className="space-y-3">
										<Badge variant="outline">{feature.tag}</Badge>
										<Typography as="h3" variant="heading-200">
											{feature.title}
										</Typography>
										<Typography as="p" variant="body-200" className="text-content-secondary">
											{feature.description}
										</Typography>
									</article>
								))}
							</div>
							<nav aria-label={copy.docsLabel} className="grid gap-4">
								<AnchorButton href={repository} variant="ghost">
									{copy.readDocs}
								</AnchorButton>
								<LinkButton
									to="/$locale/guides/getting-started"
									params={{ locale }}
									variant="ghost"
								>
									{copy.gettingStarted}
								</LinkButton>
							</nav>
						</div>
					</section>
					<section id="examples" aria-labelledby="examples-title" className="py-24 border-t">
						<div className="flex min-w-0 flex-col gap-8">
							<Typography as="h2" variant="heading-400" id="examples-title">
								{copy.examplesTitle}
							</Typography>
							<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
								{copy.examplesIntro}
							</Typography>
							<nav aria-label={copy.examplesTitle} className="grid gap-4">
								<AnchorButton href={`${site.dashboard}/login`} variant="ghost">
									{copy.examples.signIn}
								</AnchorButton>
								<div>
									<AnchorButton href={site.dashboard} variant="ghost">
										{copy.examples.dashboard}
									</AnchorButton>
									<Typography as="p" variant="body-100" className="text-content-secondary">
										{copy.examples.dashboardDetail}
									</Typography>
								</div>
								<div>
									<LinkButton to="/$locale/checkout" params={{ locale }} variant="ghost">
										{copy.examples.checkout}
									</LinkButton>
									<Typography as="p" variant="body-100" className="text-content-secondary">
										{copy.examples.checkoutDetail}
									</Typography>
								</div>
								<LinkButton to="/$locale/waitlist/success" params={{ locale }} variant="ghost">
									{copy.examples.waitlistSuccess}
								</LinkButton>
								<LinkButton to="/404" variant="ghost">
									{copy.examples.notFound}
								</LinkButton>
								<LinkButton to="/error" variant="ghost">
									{copy.examples.error}
								</LinkButton>
							</nav>
							<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
								{copy.providerNote}
							</Typography>
							<div className="max-w-xl">
								<WaitlistForm title={copy.waitlistTitle} />
							</div>
						</div>
					</section>
					<section id="tests" aria-labelledby="tests-title" className="py-24 border-t">
						<div className="flex min-w-0 flex-col gap-8">
							<Typography as="h2" variant="heading-400" id="tests-title">
								{copy.testsTitle}
							</Typography>
							<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
								{copy.testsDescription}
							</Typography>
							<nav aria-label="Setup documentation">
								<LinkButton
									to="/$locale/guides/getting-started"
									params={{ locale }}
									variant="ghost"
								>
									{copy.setupDocs}
								</LinkButton>
							</nav>
						</div>
					</section>
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
						}}
					/>
				</main>
				<MarketingFooter />
			</div>
		</div>
	)
}
