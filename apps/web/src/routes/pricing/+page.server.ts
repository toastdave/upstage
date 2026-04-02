import { loadPricingPlans, loadUserBillingSnapshot } from '$lib/server/billing'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => ({
	billing: locals.user ? await loadUserBillingSnapshot(locals.user.id) : null,
	plans: await loadPricingPlans(),
	session: locals.session,
	user: locals.user,
})
