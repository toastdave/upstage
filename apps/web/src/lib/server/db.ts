import { env } from '$env/dynamic/private'
import { createDb } from '@upstage/db'

const globalForDb = globalThis as typeof globalThis & {
	__upstageDb?: ReturnType<typeof createDb>
}

export const db = globalForDb.__upstageDb ?? createDb(env.DATABASE_URL)

if (!globalForDb.__upstageDb) {
	globalForDb.__upstageDb = db
}
