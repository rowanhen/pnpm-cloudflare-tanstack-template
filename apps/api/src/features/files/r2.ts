import { Effect, Layer } from 'effect'
import type { R2Object } from '@cloudflare/workers-types'
import type { Env } from '../../env'
import { FileKey, FileQuery, FileInfoData, FileUploadLimit } from '@workspace/contracts/values'
import { MissingRecord, InvalidInput } from '../../errors'
import { storageEffect, decodeStored } from '../../persistence'
import { validate } from '../../validation'
import { FileStore, type StoredFile } from './service'
export const fileStoreLayer = (bucket: Env['FILES'], userId: string) => {
	const prefix = `${userId}/`
	const owned = (key: string) =>
		validate(FileKey, key).pipe(Effect.map((validKey) => `${prefix}${validKey}`))
	const describe = (object: R2Object) =>
		Effect.gen(function* () {
			const key = object.key.startsWith(prefix) ? object.key.slice(prefix.length) : undefined
			const info = yield* decodeStored(FileInfoData, {
				key,
				size: object.size,
				etag: object.httpEtag,
				uploaded: object.uploaded.toISOString(),
			})
			const { cacheExpiry, ...metadata } = object.httpMetadata ?? {}
			return {
				info,
				metadata: {
					...metadata,
					...(cacheExpiry ? { cacheExpiry: cacheExpiry.toUTCString() } : {}),
				},
			} satisfies StoredFile
		})
	return Layer.succeed(FileStore, {
		list: (input) =>
			Effect.gen(function* () {
				const query = yield* validate(FileQuery, input)
				const result = yield* storageEffect(() => bucket.list({ ...query, prefix }))
				return {
					files: yield* Effect.forEach(result.objects, (object) =>
						describe(object).pipe(Effect.map((v) => v.info)),
					),
					cursor: result.truncated ? result.cursor : null,
				}
			}),
		put: (key, content, contentType) =>
			Effect.gen(function* () {
				const path = yield* owned(key)
				if (content.size > FileUploadLimit)
					return yield* Effect.fail(new InvalidInput({ message: 'File is too large' }))
				const bytes = yield* storageEffect(() => content.arrayBuffer())
				const object = yield* storageEffect(() =>
					bucket.put(path, bytes, { httpMetadata: { contentType } }),
				)
				return (yield* describe(object)).info
			}),
		get: (key) =>
			Effect.gen(function* () {
				const path = yield* owned(key)
				const object = yield* storageEffect(() => bucket.get(path))
				if (!object) return yield* Effect.fail(new MissingRecord({ message: 'File not found' }))
				const description = yield* describe(object)
				const reader = object.body.getReader()
				const body = new ReadableStream<Uint8Array>({
					async pull(controller) {
						try {
							const chunk = await reader.read()
							if (chunk.done) {
								controller.close()
								reader.releaseLock()
							} else if (chunk.value instanceof Uint8Array) controller.enqueue(chunk.value)
							else {
								await reader.cancel('Invalid R2 bytes')
								throw new Error('Invalid R2 bytes')
							}
						} catch (error) {
							controller.error(error)
							reader.releaseLock()
						}
					},
					cancel: (reason) => reader.cancel(reason).finally(() => reader.releaseLock()),
				})
				return { ...description, body }
			}),
		head: (key) =>
			Effect.gen(function* () {
				const path = yield* owned(key)
				const object = yield* storageEffect(() => bucket.head(path))
				if (!object) return yield* Effect.fail(new MissingRecord({ message: 'File not found' }))
				return yield* describe(object)
			}),
		remove: (key) =>
			owned(key).pipe(Effect.flatMap((path) => storageEffect(() => bucket.delete(path)))),
	})
}
