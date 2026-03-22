import { getAuthProviderAvailability } from '$lib/server/auth-providers'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => ({
	authProviders: getAuthProviderAvailability(),
	session: locals.session,
	user: locals.user,
})
