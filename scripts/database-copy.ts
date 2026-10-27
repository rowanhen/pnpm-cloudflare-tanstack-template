import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { domains, type Domain } from '../packages/data/src/domains.ts'

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`
const literal = (value: SQLInputValue): string => {
	if (value === null) return 'NULL'
	if (typeof value === 'number' || typeof value === 'bigint') return String(value)
	if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
	return `X'${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')}'`
}
export function readDump(sql: string) {
	const database = new DatabaseSync(':memory:')
	try {
		database.exec('PRAGMA foreign_keys=OFF')
		database.exec(sql)
		return database
	} catch (error) {
		database.close()
		throw error
	}
}
export function rows(database: DatabaseSync, table: string) {
	return database.prepare(`SELECT * FROM ${identifier(table)} ORDER BY rowid`).all()
}
export function copySql(source: DatabaseSync, domain: Domain) {
	const statements = ['PRAGMA defer_foreign_keys=ON;']
	for (const table of domains[domain].tables) {
		for (const row of rows(source, table)) {
			statements.push(
				`INSERT INTO ${identifier(table)} (${Object.keys(row).map(identifier).join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`,
			)
		}
	}
	return statements.join('\n')
}
export function verifyCopy(source: DatabaseSync, target: DatabaseSync, domain: Domain) {
	for (const table of domains[domain].tables) {
		// Row order and column order are not part of a record's identity.
		const canonical = (db: DatabaseSync) =>
			rows(db, table)
				.map((row) => JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))
				.sort()
		if (JSON.stringify(canonical(source)) !== JSON.stringify(canonical(target)))
			throw new Error(`Copied data does not match: ${domain}.${table}`)
	}
	if (target.prepare('PRAGMA foreign_key_check').all().length)
		throw new Error(`Foreign key check failed: ${domain}`)
}
