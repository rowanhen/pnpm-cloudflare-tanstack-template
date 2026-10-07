import { randomBytes, createHmac } from 'node:crypto'

export function fixtures(secret, secure = false) {
	const users = ['alice', 'bob'].map((name) => ({
		id: `e2e-${name}`,
		name,
		email: `${name}@example.test`,
		session: randomBytes(32).toString('hex'),
	}))
	const now = new Date().toISOString()
	const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
	let sql = users
		.map(
			(
				user,
			) => `INSERT INTO users (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('${user.id}', '${user.name}', '${user.email}', 1, '${now}', '${now}');
 INSERT INTO sessions (id, userId, token, expiresAt, createdAt, updatedAt) VALUES ('session-${user.id}', '${user.id}', '${user.session}', '${expires}', '${now}', '${now}');`,
		)
		.join('\n')
	const cookieName = `${secure ? '__Secure-' : ''}starter.session_token`
	const cookies = users.map(
		(user) =>
			`${cookieName}=${encodeURIComponent(`${user.session}.${createHmac('sha256', secret).update(user.session).digest('base64')}`)}`,
	)
	const expiredToken = randomBytes(32).toString('hex')
	const expired = new Date(Date.now() - 60000).toISOString()
	sql += `\nINSERT INTO sessions (id, userId, token, expiresAt, createdAt, updatedAt) VALUES ('expired-session', '${users[0].id}', '${expiredToken}', '${expired}', '${now}', '${now}');`
	cookies.push(
		`${cookieName}=${encodeURIComponent(`${expiredToken}.${createHmac('sha256', secret).update(expiredToken).digest('base64')}`)}`,
	)
	return { users, cookies, sql }
}
