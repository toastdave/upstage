import { dev } from '$app/environment'
import { getRequestEvent } from '$app/server'
import { env } from '$env/dynamic/private'
import { getSocialProviderConfig } from '$lib/server/auth-providers'
import { db } from '$lib/server/db'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import * as schema from '@upstage/db/schema'
import { betterAuth } from 'better-auth'
import { sveltekitCookies } from 'better-auth/svelte-kit'

const localDevOrigins = ['http://127.0.0.1:1201', 'http://localhost:1201']

function parseOrigins(value: string | undefined) {
	if (!value) {
		return []
	}

	return value
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
}

const configuredBaseURL =
	env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || 'http://localhost:1201'
const configuredSecret =
	env.BETTER_AUTH_SECRET ||
	process.env.BETTER_AUTH_SECRET ||
	'development-only-better-auth-secret-0001'

export const auth = betterAuth({
	baseURL: configuredBaseURL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [sveltekitCookies(getRequestEvent)],
	secret: configuredSecret,
	socialProviders: getSocialProviderConfig(),
	trustedOrigins: async (request) => {
		const origins = new Set<string>([...parseOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS)])

		if (dev) {
			origins.add('https://**.ts.net')

			for (const origin of localDevOrigins) {
				origins.add(origin)
			}
		}

		if (request) {
			origins.add(new URL(request.url).origin)
		}

		return [...origins]
	},
})
