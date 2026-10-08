import { defineConfig } from 'drizzle-kit'
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/schema.ts',
	out: '../../apps/api/migrations',
	migrations: { prefix: 'timestamp' },
})
