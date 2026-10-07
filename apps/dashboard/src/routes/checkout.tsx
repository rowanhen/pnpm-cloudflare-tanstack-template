import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '../lib/session'
export const Route = createFileRoute('/checkout')({
	beforeLoad: async () => {
		const user = await getSession()
		if (!user) throw redirect({ to: '/login', search: { next: 'checkout' } })
		return { user }
	},
	component: Outlet,
})
