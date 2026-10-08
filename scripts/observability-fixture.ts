import { createServer } from 'node:http'
import { gunzipSync } from 'node:zlib'
import { serverPort } from './tooling.ts'

export async function observabilityFixture() {
	const batches: unknown[] = []
	const server = createServer(async (request, response) => {
		const chunks: Buffer[] = []
		for await (const chunk of request) chunks.push(Buffer.from(chunk))
		const buffer = Buffer.concat(chunks)
		try {
			batches.push(JSON.parse((buffer[0] === 31 ? gunzipSync(buffer) : buffer).toString()))
			response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
		} catch {
			response.writeHead(400).end()
		}
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	return {
		url: `http://127.0.0.1:${serverPort(server)}`,
		batches,
		stop: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	}
}
