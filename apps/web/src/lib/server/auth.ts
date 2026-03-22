import { getRequestEvent } from '$app/server'
import { env } from '$env/dynamic/private'
import { getSocialProviderConfig } from '$lib/server/auth-providers'
import { db } from '$lib/server/db'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import * as schema from '@upstage/db/schema'
import { betterAuth } from 'better-auth'
import { sveltekitCookies } from 'better-auth/svelte-kit'

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [sveltekitCookies(getRequestEvent)],
	secret: env.BETTER_AUTH_SECRET,
	socialProviders: getSocialProviderConfig(),
})
