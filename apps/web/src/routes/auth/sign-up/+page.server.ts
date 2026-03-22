import { normalizeRedirectTo } from '$lib/auth/redirects'
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		throw redirect(303, normalizeRedirectTo(url.searchParams.get('redirectTo')))
	}
}
