import { useAnalyticsIdentity } from '@workspace/shared/components/analytics'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '../lib/session'
import { signInPath } from '../lib/login'
export const Route = createFileRoute('/checkout')({
	beforeLoad: async ({ location }) => {
		const user = await getSession()
		if (!user) throw redirect({ href: signInPath(location.pathname, location.search) })
		return { user }
	},
	component: CheckoutLayout,
})

function CheckoutLayout() {
	const { user } = Route.useRouteContext()
	useAnalyticsIdentity(user.id)
	return <Outlet />
}
