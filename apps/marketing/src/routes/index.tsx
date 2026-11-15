import { createFileRoute, redirect } from '@tanstack/react-router'
import { defaultLocale } from '../lib/locale'

export const Route = createFileRoute('/')({
	beforeLoad: () => {
		throw redirect({ to: '/$locale', params: { locale: defaultLocale }, statusCode: 308 })
	},
})
