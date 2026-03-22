import { env } from '$env/dynamic/private'

export type AuthProviderAvailability = {
	github: boolean
	google: boolean
}

export function getAuthProviderAvailability(): AuthProviderAvailability {
	return {
		github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
	}
}

export function getSocialProviderConfig() {
	const providers: {
		github?: { clientId: string; clientSecret: string }
		google?: {
			accessType: 'offline'
			clientId: string
			clientSecret: string
			prompt: 'select_account consent'
		}
	} = {}

	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		providers.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		}
	}

	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		providers.google = {
			accessType: 'offline',
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			prompt: 'select_account consent',
		}
	}

	return providers
}
