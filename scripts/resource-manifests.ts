import { z } from 'zod'

const resources = z.object({
	account: z.string(),
	name: z.string(),
	databaseName: z.string(),
	bucket: z.string(),
	databaseId: z.string().optional(),
	workerAttempted: z.boolean().optional(),
	databaseAttempted: z.boolean().optional(),
	bucketAttempted: z.boolean().optional(),
})
export const sandboxManifest = resources.extend({
	kind: z.literal('starter-sandbox-v1'),
	api: z.url(),
	dashboard: z.url(),
	marketing: z.url(),
	marketingAttempted: z.boolean().optional(),
	dashboardAttempted: z.boolean().optional(),
})
export type SandboxManifest = z.infer<typeof sandboxManifest>
export const remoteManifest = resources.extend({ pagesAttempted: z.array(z.string()) })
export type RemoteManifest = z.infer<typeof remoteManifest>
export const stripeManifest = z.object({
	kind: z.literal('starter-stripe-demo'),
	id: z.string(),
	product: z.string().optional(),
	price: z.string().optional(),
	webhook: z.string().optional(),
	webhookSecretHash: z.string().optional(),
})
export type StripeManifest = z.infer<typeof stripeManifest>
