import { syncUserBillingStateWithPolar } from '$lib/server/billing'
import { db } from '$lib/server/db'
import {
	PolarApiError,
	WebhookVerificationError,
	validatePolarWebhookPayload,
} from '$lib/server/polar'
import { extractUpstageUserIdFromPolarPayload } from '$lib/server/polar-helpers'
import { billingEvent } from '@upstage/db/schema'
import { eq } from 'drizzle-orm'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
	const body = new Uint8Array(await request.arrayBuffer())

	try {
		const payload = validatePolarWebhookPayload(body, request.headers)
		const providerEventId =
			payload && typeof payload === 'object' && 'id' in payload && typeof payload.id === 'string'
				? payload.id
				: null
		const eventName =
			payload &&
			typeof payload === 'object' &&
			'type' in payload &&
			typeof payload.type === 'string'
				? payload.type
				: null

		if (!providerEventId || !eventName) {
			return new Response('', { status: 400 })
		}

		const [existingEvent] = await db
			.select({ id: billingEvent.id, processedAt: billingEvent.processedAt })
			.from(billingEvent)
			.where(eq(billingEvent.providerEventId, providerEventId))
			.limit(1)

		if (existingEvent?.processedAt) {
			return new Response('', { status: 202 })
		}

		if (!existingEvent) {
			await db.insert(billingEvent).values({
				eventName,
				payload,
				providerEventId,
			})
		}

		const upstageUserId = extractUpstageUserIdFromPolarPayload(payload)

		if (upstageUserId) {
			await syncUserBillingStateWithPolar(upstageUserId)
		}

		await db
			.update(billingEvent)
			.set({ processedAt: new Date() })
			.where(eq(billingEvent.providerEventId, providerEventId))

		return new Response('', { status: 202 })
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			return new Response('', { status: 403 })
		}

		if (error instanceof PolarApiError || error instanceof Error) {
			return new Response('', { status: 503 })
		}

		return new Response('', { status: 500 })
	}
}
