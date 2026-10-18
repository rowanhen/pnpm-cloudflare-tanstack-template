import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import { domains, type Domain } from '../../packages/data/src/domains.ts'
import { copySql, verifyCopy } from '../../scripts/database-copy.ts'
import { fixtures } from '../support/test-fixtures.ts'

async function migrate(database: DatabaseSync, directory: URL) {
	for (const file of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort())
		database.exec(await readFile(new URL(file, directory), 'utf8'))
}
test('legacy data splits into isolated databases without losing sessions, payments or private data', async () => {
	const source = new DatabaseSync(':memory:')
	try {
		await migrate(source, new URL('../../apps/api/legacy-migrations/', import.meta.url))
		const fixture = fixtures('split-test')
		source.exec(fixture.sql + fixture.billingSql)
		source.exec(`INSERT INTO api_keys(id,user_id,name,key_hash,prefix) VALUES ('key','e2e-alice','Key','hash','prefix');
		INSERT INTO todos(id,user_id,title) VALUES ('todo','e2e-alice','An existing task');
		INSERT INTO waitlist(id,email,consent) VALUES ('wait','alice@example.test',1);
		INSERT INTO email_deliveries(id,dedupe_key,user_id,to_email,template) VALUES ('mail','one','e2e-alice','alice@example.test','test');
		INSERT INTO orders(id,user_id,request_id,amount,currency,status,credits) VALUES ('order','e2e-alice','request',1200,'gbp','paid',1000);
		INSERT INTO stripe_events(id) VALUES ('event');
		INSERT INTO credit_grants(id,user_id,order_id,credits) VALUES ('grant','e2e-alice','order',1000);
		INSERT INTO paid_requests(id,user_id,key_id,idempotency_key,operation,input_hash,credits,response) VALUES ('receipt','e2e-alice','key','request','summary','hash',1,'{}');`)
		for (const [domain, { tables }] of Object.entries(domains)) {
			const target = new DatabaseSync(':memory:')
			try {
				target.exec('PRAGMA foreign_keys=ON')
				await migrate(target, new URL(`../../apps/api/migrations/${domain}/`, import.meta.url))
				target.exec(copySql(source, domain as Domain))
				verifyCopy(source, target, domain as Domain)
				assert.deepEqual(
					target
						.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
						.all()
						.map((row) => row.name),
					[...tables].sort(),
				)
				assert.throws(() => target.exec(copySql(source, domain as Domain)), /UNIQUE/)
				if (domain === 'billing') {
					assert.throws(() => target.exec('UPDATE credit_accounts SET balance=-1'), /CHECK/)
					assert.throws(
						() =>
							target.exec(
								"INSERT INTO credit_grants(id,user_id,order_id,credits) VALUES ('bad','e2e-alice','missing',1)",
							),
						/FOREIGN KEY/,
					)
				}
				if (domain === 'identity')
					assert.throws(
						() =>
							target.exec(
								"INSERT INTO sessions(id,userId,token,expiresAt,createdAt,updatedAt) VALUES ('bad','missing','unique','now','now','now')",
							),
						/FOREIGN KEY/,
					)
				if (domain === 'product')
					assert.throws(
						() =>
							target.exec(
								"INSERT INTO waitlist(id,email,consent) VALUES ('duplicate','ALICE@example.test',1)",
							),
						/UNIQUE/,
					)
			} finally {
				target.close()
			}
		}
		assert.equal(source.prepare('SELECT balance FROM credit_accounts LIMIT 1').get()?.balance, 3)
	} finally {
		source.close()
	}
})
