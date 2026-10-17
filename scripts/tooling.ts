import type { Server } from 'node:http'

export function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && 'code' in error && error.code === code
}
export function serverPort(server: Server): number {
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server')
	return address.port
}
export type TestRequestInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
