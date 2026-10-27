import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as identity from './identity'
import * as billing from './billing'
import * as product from './product'

export const identityDatabase = (binding: D1Database) => drizzle(binding, { schema: identity })
export const billingDatabase = (binding: D1Database) => drizzle(binding, { schema: billing })
export const productDatabase = (binding: D1Database) => drizzle(binding, { schema: product })
