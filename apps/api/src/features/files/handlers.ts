import { Effect } from 'effect'
import type {
	DeleteFileHandler,
	DownloadFileHandler,
	HeadFileHandler,
	ListFilesHandler,
	UploadFileHandler,
} from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { userFiles } from '../../runtime/user-resources'
import { fileHeaders } from './http'

export const deleteFile: DeleteFileHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* userFiles(ctx.env, ctx.userId).remove(input.params.key)
		return { status: 204, body: undefined }
	})

export const downloadFile: DownloadFileHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userFiles(ctx.env, ctx.userId).get(input.params.key)
		return { status: 200, body: value.body, headers: fileHeaders(value) }
	})

export const headFile: HeadFileHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userFiles(ctx.env, ctx.userId).head(input.params.key)
		return { status: 200, body: undefined, headers: fileHeaders(value) }
	})

export const listFiles: ListFilesHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userFiles(ctx.env, ctx.userId).list(input.query)
		return { status: 200, body: value }
	})

export const uploadFile: UploadFileHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userFiles(ctx.env, ctx.userId).put(
			input.params.key,
			input.body,
			ctx.request.headers.get('content-type') ?? 'application/octet-stream',
		)
		return { status: 201, body: { file: { key: value.key, size: value.size, etag: value.etag } } }
	})
