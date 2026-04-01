import { createPolarCustomerPortalSession } from '$lib/server/polar'
import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

function buildAccountRedirect(url: URL, billingStatus: string) {
	const destination = new URL('/account', url)
	destination.searchParams.set('billing', billingStatus)

	return destination.toString()
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/sign-in?redirectTo=/account')
	}

	try {
		const session = await createPolarCustomerPortalSession({
			externalCustomerId: locals.user.id,
			returnUrl: buildAccountRedirect(url, 'portal-returned'),
		})

		throw redirect(303, session.url)
	} catch {
		throw redirect(303, buildAccountRedirect(url, 'portal-error'))
	}
}
