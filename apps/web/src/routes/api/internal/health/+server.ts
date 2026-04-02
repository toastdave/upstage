import {
	getAiRuntimeConfig,
	getGenerationProcessingMode,
	getGenerationRoute,
} from '$lib/server/ai/config'
import { db } from '$lib/server/db'
import { loadGenerationOperationsSnapshot } from '$lib/server/generation-jobs'
import { validateInternalApiAuthorization } from '$lib/server/internal-api'
import { getPolarPublicConfig } from '$lib/server/polar'
import { checkStorageHealth } from '$lib/server/storage'
import { json } from '@sveltejs/kit'
import { generationJob } from '@upstage/db/schema'
import { sql } from 'drizzle-orm'
import type { RequestHandler } from './$types'

async function checkDatabaseHealth() {
	try {
		await db.select({ count: sql<number>`count(*)` }).from(generationJob).limit(1)

		return {
			status: 'ok' as const,
		}
	} catch (error) {
		return {
			message:
				error instanceof Error ? error.message : 'Database health check failed unexpectedly.',
			status: 'error' as const,
		}
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const authorizationError = validateInternalApiAuthorization(request)

	if (authorizationError) {
		return json({ error: authorizationError.error }, { status: authorizationError.status })
	}

	const runtime = getAiRuntimeConfig()
	const polar = getPolarPublicConfig()
	const [database, storage] = await Promise.all([checkDatabaseHealth(), checkStorageHealth()])

	let generationOperations = null
	let generationOperationsError: string | null = null

	if (database.status === 'ok') {
		try {
			generationOperations = await loadGenerationOperationsSnapshot()
		} catch (error) {
			generationOperationsError =
				error instanceof Error
					? error.message
					: 'Generation operations snapshot failed unexpectedly.'
		}
	}

	const overallStatus =
		database.status === 'ok' && storage.status === 'ok' && !generationOperationsError
			? 'ok'
			: 'degraded'

	return json(
		{
			status: overallStatus,
			services: {
				app: {
					status: 'ok' as const,
				},
				billing: {
					accessTokenConfigured: polar.accessTokenConfigured,
					checkoutReady: polar.checkoutReady,
					server: polar.server,
					status: polar.accessTokenConfigured && polar.webhookReady ? 'ok' : ('degraded' as const),
					webhookReady: polar.webhookReady,
				},
				database,
				generation: {
					executionMode: runtime.executionMode,
					gatewayConfigured: Boolean(runtime.gatewayApiKey),
					localImageRouteEnabled: runtime.localImageRouteEnabled,
					operations: generationOperations,
					operationsError: generationOperationsError,
					processingMode: getGenerationProcessingMode(),
					route: getGenerationRoute(),
					status:
						database.status === 'ok' && !generationOperationsError ? 'ok' : ('degraded' as const),
				},
				storage,
			},
		},
		{ status: overallStatus === 'ok' ? 200 : 503 }
	)
}
