import type { Server } from 'node:http'
import baseConfig from '../apps/api/wrangler.json' with { type: 'json' }

export function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && 'code' in error && error.code === code
}
export function serverPort(server: Server): number {
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server')
	return address.port
}
export type WorkerConfig = Omit<typeof baseConfig, 'vars' | 'send_email'> & {
	account_id?: string
	vars: Record<string, string>
	send_email: { name: string; allowed_sender_addresses?: string[] }[]
}
export function workerConfig(): WorkerConfig {
	return structuredClone(baseConfig)
}
export type TestRequestInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
