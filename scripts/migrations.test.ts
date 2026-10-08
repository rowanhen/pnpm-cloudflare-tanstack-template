import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdir, readFile } from 'node:fs/promises'
import { fixtures } from './test-fixtures.ts'

test('Drizzle adoption preserves existing auth sessions, private data and balances', async () => {
	const db = new DatabaseSync(':memory:')
	try {
		db.exec('PRAGMA foreign_keys=ON')
		const directory = new URL('../apps/api/migrations/', import.meta.url)
		const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()
		for (const file of files.filter((name) => name.startsWith('000')))
			db.exec(await readFile(new URL(file, directory), 'utf8'))
		db.exec(fixtures('migration-test-secret').sql)
		db.exec(
			"INSERT INTO todos(id,title,user_id) VALUES ('preserved','Existing idea','e2e-alice'); INSERT INTO waitlist(id,email,consent) VALUES ('signup','Alice@example.test',1)",
		)
		const snapshot = () =>
			['users', 'sessions', 'credit_accounts', 'todos', 'waitlist'].map((table) =>
				db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),
			)
		const before = snapshot()
		for (const file of files.filter((name) => !name.startsWith('000')))
			db.exec(await readFile(new URL(file, directory), 'utf8'))
		assert.deepEqual(snapshot(), before)
		assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
		assert.throws(
			() =>
				db.exec(
					"INSERT INTO waitlist(id,email,consent) VALUES ('duplicate','alice@example.test',1)",
				),
			/UNIQUE/,
		)
		db.exec(
			"INSERT INTO email_deliveries(id,dedupe_key,user_id,to_email,template) VALUES ('mail','test:1','e2e-alice','alice@example.test','test')",
		)
		assert.equal(db.prepare('SELECT status FROM email_deliveries').get()?.status, 'sending')
	} finally {
		db.close()
	}
})
