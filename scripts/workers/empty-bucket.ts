interface CleanupEnv {
	FILES: R2Bucket
	CLEANUP_TOKEN: string
}
export default {
	async fetch(request: Request, env: CleanupEnv) {
		if (
			request.method !== 'DELETE' ||
			request.headers.get('Authorization') !== `Bearer ${env.CLEANUP_TOKEN}`
		)
			return new Response(null, { status: 401 })
		const result = await env.FILES.list({ limit: 1000 })
		if (result.objects.length) await env.FILES.delete(result.objects.map((object) => object.key))
		return Response.json({ deleted: result.objects.length })
	},
} satisfies ExportedHandler<CleanupEnv>
