import { env } from '$env/dynamic/private'
import { type PolarServerMode, normalizePolarServerMode } from '$lib/server/polar-helpers'
import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks.js'

type PolarCheckoutPlan = 'pro'

export type PolarPublicConfig = {
	accessTokenConfigured: boolean
	checkoutReady: boolean
	environmentLabel: string
	proProductConfigured: boolean
	proProductId: string | null
	server: PolarServerMode
	webhookReady: boolean
}

export type PolarCustomerState = {
	active_subscriptions: Array<{
		id: string
		product_id: string
		status: 'active' | 'trialing'
	}>
	id: string
}

class PolarApiError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'PolarApiError'
		this.status = status
	}
}

function isActivePolarSubscription(
	subscription: unknown
): subscription is { id: string; product_id: string; status: 'active' | 'trialing' } {
	if (!subscription || typeof subscription !== 'object') {
		return false
	}

	const record = subscription as Record<string, unknown>

	return (
		typeof record.id === 'string' &&
		typeof record.product_id === 'string' &&
		(record.status === 'active' || record.status === 'trialing')
	)
}

function coalesce(...values: Array<string | undefined>) {
	return values.find((value) => value && value.trim().length > 0)?.trim()
}

function getPolarServerMode() {
	return normalizePolarServerMode(coalesce(env.POLAR_SERVER, process.env.POLAR_SERVER))
}

function getPolarApiBaseUrl(server = getPolarServerMode()) {
	return server === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh'
}

function getPolarAccessToken() {
	return coalesce(env.POLAR_ACCESS_TOKEN, process.env.POLAR_ACCESS_TOKEN)
}

function getPolarWebhookSecret() {
	return coalesce(env.POLAR_WEBHOOK_SECRET, process.env.POLAR_WEBHOOK_SECRET)
}

function getProProductId() {
	return coalesce(env.POLAR_PRO_PRODUCT_ID, process.env.POLAR_PRO_PRODUCT_ID)
}

function requirePolarAccessToken() {
	const accessToken = getPolarAccessToken()

	if (!accessToken) {
		throw new Error('POLAR_ACCESS_TOKEN is required before using Polar billing routes')
	}

	return accessToken
}

function getProductIdForPlan(planSlug: PolarCheckoutPlan) {
	if (planSlug === 'pro') {
		return getProProductId()
	}

	return null
}

function parsePolarErrorMessage(payload: unknown, fallback: string) {
	if (!payload || typeof payload !== 'object') {
		return fallback
	}

	if ('detail' in payload && typeof payload.detail === 'string') {
		return payload.detail
	}

	if ('error' in payload && typeof payload.error === 'string') {
		return payload.error
	}

	return fallback
}

async function polarJsonRequest(path: string, init: RequestInit) {
	const accessToken = requirePolarAccessToken()
	const response = await fetch(`${getPolarApiBaseUrl()}${path}`, {
		...init,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...(init.headers ?? {}),
		},
	})
	const payload = await response.json().catch(() => null)

	if (!response.ok) {
		throw new PolarApiError(
			parsePolarErrorMessage(payload, `Polar request failed with status ${response.status}`),
			response.status
		)
	}

	return payload
}

export function getPolarPublicConfig(): PolarPublicConfig {
	const server = getPolarServerMode()
	const accessTokenConfigured = Boolean(getPolarAccessToken())
	const proProductId = getProProductId() ?? null

	return {
		accessTokenConfigured,
		checkoutReady: accessTokenConfigured && Boolean(proProductId),
		environmentLabel: server === 'production' ? 'Polar production' : 'Polar sandbox',
		proProductConfigured: Boolean(proProductId),
		proProductId,
		server,
		webhookReady: Boolean(getPolarWebhookSecret()),
	}
}

export async function createPolarCheckoutSession(options: {
	customerEmail: string
	customerExternalId: string
	customerName: string
	metadata?: Record<string, string>
	planSlug: PolarCheckoutPlan
	returnUrl: string
	successUrl: string
}) {
	const productId = getProductIdForPlan(options.planSlug)

	if (!productId) {
		throw new Error('POLAR_PRO_PRODUCT_ID is required before starting a Polar checkout')
	}

	const payload = await polarJsonRequest('/v1/checkouts/', {
		body: JSON.stringify({
			customer_email: options.customerEmail,
			customer_name: options.customerName,
			external_customer_id: options.customerExternalId,
			metadata: options.metadata ?? {},
			products: [productId],
			return_url: options.returnUrl,
			success_url: options.successUrl,
		}),
		method: 'POST',
	})

	if (!payload || typeof payload !== 'object' || typeof payload.url !== 'string') {
		throw new Error('Polar checkout did not return a checkout URL')
	}

	return {
		checkoutId: 'id' in payload && typeof payload.id === 'string' ? payload.id : null,
		url: payload.url,
	}
}

export async function createPolarCustomerPortalSession(options: {
	externalCustomerId: string
	returnUrl: string
}) {
	const payload = await polarJsonRequest('/v1/customer-sessions/', {
		body: JSON.stringify({
			external_customer_id: options.externalCustomerId,
			return_url: options.returnUrl,
		}),
		method: 'POST',
	})

	if (!payload || typeof payload !== 'object' || typeof payload.customer_portal_url !== 'string') {
		throw new Error('Polar did not return a customer portal URL')
	}

	return {
		url: payload.customer_portal_url,
	}
}

export async function fetchPolarCustomerState(
	externalCustomerId: string
): Promise<PolarCustomerState | null> {
	try {
		const payload = await polarJsonRequest(
			`/v1/customers/external/${encodeURIComponent(externalCustomerId)}/state`,
			{ method: 'GET' }
		)

		if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') {
			return null
		}

		const activeSubscriptions = Array.isArray(payload.active_subscriptions)
			? (payload.active_subscriptions as unknown[])
					.filter(isActivePolarSubscription)
					.map((subscription) => ({
						id: subscription.id,
						product_id: subscription.product_id,
						status: subscription.status,
					}))
			: []

		return {
			active_subscriptions: activeSubscriptions,
			id: payload.id,
		}
	} catch (error) {
		if (error instanceof PolarApiError && error.status === 404) {
			return null
		}

		throw error
	}
}

export function validatePolarWebhookPayload(body: Uint8Array, headers: Headers) {
	const webhookSecret = getPolarWebhookSecret()

	if (!webhookSecret) {
		throw new Error('POLAR_WEBHOOK_SECRET is required before receiving Polar webhooks')
	}

	return validateEvent(Buffer.from(body), Object.fromEntries(headers.entries()), webhookSecret)
}

export { PolarApiError, WebhookVerificationError }
