import { loadRecentBillingEventsForUser, loadUserBillingSnapshot } from '$lib/server/billing'
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

function getBillingNotice(url: URL) {
	switch (url.searchParams.get('billing')) {
		case 'checkout-success':
			return {
				message:
					'Polar checkout returned successfully. Refreshing your billing state from the sandbox environment.',
				tone: 'success' as const,
			}
		case 'checkout-cancelled':
			return {
				message: 'Polar checkout was canceled before payment completed.',
				tone: 'neutral' as const,
			}
		case 'checkout-error':
			return {
				message:
					'We could not start the Polar checkout yet. Confirm the sandbox product ID and access token are configured.',
				tone: 'error' as const,
			}
		case 'portal-error':
			return {
				message:
					'We could not open the Polar customer portal for this account yet. Complete a checkout first or confirm the sandbox customer exists.',
				tone: 'error' as const,
			}
		case 'portal-returned':
			return {
				message: 'Returned from the Polar customer portal.',
				tone: 'neutral' as const,
			}
		default:
			return null
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, '/auth/sign-in?redirectTo=/account/billing')
	}

	const billing = await loadUserBillingSnapshot(locals.user.id, { ledgerLimit: 12 })
	const recentEvents = await loadRecentBillingEventsForUser(locals.user.id, 12)

	return {
		billing,
		billingNotice: getBillingNotice(url),
		polarWebhookUrl: new URL('/api/webhooks/polar', url).toString(),
		recentEvents,
		session: locals.session,
		user: locals.user,
	}
}
