import { Context, type Effect } from 'effect'
import type { FileQuery, FileInfoData } from '@workspace/contracts/values'
import type { InvalidInput, MissingRecord } from '../../errors'
import type { StorageError } from '../../persistence'
export type FileInfo = typeof FileInfoData.Type
export type FileMetadata = {
	readonly contentType?: string
	readonly contentLanguage?: string
	readonly contentDisposition?: string
	readonly contentEncoding?: string
	readonly cacheControl?: string
	readonly cacheExpiry?: string
}
export type StoredFile = { readonly info: FileInfo; readonly metadata: FileMetadata }
export class FileStore extends Context.Service<
	FileStore,
	{
		readonly list: (
			query: typeof FileQuery.Type,
		) => Effect.Effect<
			{ files: readonly FileInfo[]; cursor: string | null },
			StorageError | InvalidInput
		>
		readonly put: (
			key: string,
			content: File,
			contentType: string,
		) => Effect.Effect<FileInfo, StorageError | InvalidInput>
		readonly get: (
			key: string,
		) => Effect.Effect<
			StoredFile & { body: ReadableStream<Uint8Array> },
			StorageError | InvalidInput | MissingRecord
		>
		readonly head: (
			key: string,
		) => Effect.Effect<StoredFile, StorageError | InvalidInput | MissingRecord>
		readonly remove: (key: string) => Effect.Effect<void, StorageError | InvalidInput>
	}
>()('files/Store') {}
