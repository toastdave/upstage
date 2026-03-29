import { env } from '$env/dynamic/private'
import { createDb } from '@upstage/db'

const globalForDb = globalThis as typeof globalThis & {
	__upstageDb?: ReturnType<typeof createDb>
}

function getDatabase() {
	if (!globalForDb.__upstageDb) {
		const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL

		if (!databaseUrl) {
			throw new Error('DATABASE_URL is required to create a database client')
		}

		globalForDb.__upstageDb = createDb(databaseUrl)
	}

	return globalForDb.__upstageDb
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
	get(_target, property, receiver) {
		return Reflect.get(getDatabase(), property, receiver)
	},
})
