import { createPolarCheckoutSession } from '$lib/server/polar'
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
		const checkout = await createPolarCheckoutSession({
			customerEmail: locals.user.email,
			customerExternalId: locals.user.id,
			customerName: locals.user.name,
			metadata: {
				planSlug: 'pro',
				upstageUserId: locals.user.id,
			},
			planSlug: 'pro',
			returnUrl: buildAccountRedirect(url, 'checkout-cancelled'),
			successUrl: `${buildAccountRedirect(url, 'checkout-success')}&checkout_id={CHECKOUT_ID}`,
		})

		throw redirect(303, checkout.url)
	} catch {
		throw redirect(303, buildAccountRedirect(url, 'checkout-error'))
	}
}
