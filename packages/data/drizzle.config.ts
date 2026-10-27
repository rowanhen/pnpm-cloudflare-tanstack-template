import { defineConfig } from 'drizzle-kit'
import { domains, type Domain } from './src/domains'
const domain = process.env.DB_DOMAIN as Domain
if (!Object.hasOwn(domains, domain))
	throw new Error('Choose DB_DOMAIN: identity, billing or product')
export default defineConfig({
	dialect: 'sqlite',
	schema: `./src/${domain}.ts`,
	out: `../../apps/api/migrations/${domain}`,
	migrations: { prefix: 'timestamp' },
})
