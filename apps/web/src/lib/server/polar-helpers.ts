export type PolarServerMode = 'sandbox' | 'production'

type PolarCustomerStateLike = {
	active_subscriptions?: Array<{
		id?: string | null
		product_id?: string | null
		status?: 'active' | 'trialing' | null
	}>
	id?: string | null
}

export function normalizePolarServerMode(value: string | null | undefined): PolarServerMode {
	return value === 'production' ? 'production' : 'sandbox'
}

export function mapPolarCustomerStateToEntitlement(
	state: PolarCustomerStateLike,
	proProductId: string | null
) {
	const matchingSubscription =
		state.active_subscriptions?.find(
			(subscription) =>
				typeof subscription.product_id === 'string' && subscription.product_id === proProductId
		) ?? null

	return {
		planId: matchingSubscription ? 'pro' : 'free',
		polarCustomerId: typeof state.id === 'string' ? state.id : null,
		polarSubscriptionId:
			typeof matchingSubscription?.id === 'string' ? matchingSubscription.id : null,
		status:
			matchingSubscription?.status === 'trialing'
				? 'trialing'
				: matchingSubscription
					? 'active'
					: 'free',
	} as const
}

export function extractUpstageUserIdFromPolarPayload(payload: unknown) {
	if (!payload || typeof payload !== 'object') {
		return null
	}

	const directMetadata =
		'metadata' in payload && payload.metadata && typeof payload.metadata === 'object'
			? payload.metadata
			: null

	if (
		directMetadata &&
		'upstageUserId' in directMetadata &&
		typeof directMetadata.upstageUserId === 'string' &&
		directMetadata.upstageUserId.length > 0
	) {
		return directMetadata.upstageUserId
	}

	const data = 'data' in payload ? payload.data : null

	if (!data || typeof data !== 'object') {
		return null
	}

	const metadata =
		'metadata' in data && data.metadata && typeof data.metadata === 'object' ? data.metadata : null

	if (
		metadata &&
		'upstageUserId' in metadata &&
		typeof metadata.upstageUserId === 'string' &&
		metadata.upstageUserId.length > 0
	) {
		return metadata.upstageUserId
	}

	if ('external_customer_id' in data && typeof data.external_customer_id === 'string') {
		return data.external_customer_id
	}

	if (
		'customer' in data &&
		data.customer &&
		typeof data.customer === 'object' &&
		'external_id' in data.customer &&
		typeof data.customer.external_id === 'string'
	) {
		return data.customer.external_id
	}

	return null
}
