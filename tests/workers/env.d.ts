import type { Env as ApiEnv } from '../../apps/api/src/env'

declare global {
	namespace Cloudflare {
		interface Env extends ApiEnv {}
	}
}
