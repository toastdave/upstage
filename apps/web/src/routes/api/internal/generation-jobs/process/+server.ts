import { getGenerationJobRunnerToken } from '$lib/server/ai/config'
import { processNextQueuedGenerationJob, runQueuedGenerationJob } from '$lib/server/generation-jobs'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

function parseLimit(value: unknown) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 1
	}

	return Math.min(Math.max(Math.trunc(value), 1), 25)
}

function parsePositiveInteger(value: unknown) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null
	}

	const normalized = Math.trunc(value)

	return normalized > 0 ? normalized : null
}

export const POST: RequestHandler = async ({ request }) => {
	const token = getGenerationJobRunnerToken()

	if (!token) {
		return json(
			{ error: 'AI_JOB_RUNNER_TOKEN must be configured before using the job runner endpoint.' },
			{ status: 503 }
		)
	}

	if (request.headers.get('authorization') !== `Bearer ${token}`) {
		return json({ error: 'Unauthorized.' }, { status: 401 })
	}

	let payload: {
		heartbeatIntervalSeconds?: unknown
		jobId?: unknown
		leaseSeconds?: unknown
		limit?: unknown
		runnerId?: unknown
	} = {}

	if ((request.headers.get('content-type') ?? '').includes('application/json')) {
		try {
			payload = (await request.json()) as typeof payload
		} catch {
			return json({ error: 'Request body must be valid JSON.' }, { status: 400 })
		}
	}

	const jobId = typeof payload.jobId === 'string' && payload.jobId.length > 0 ? payload.jobId : null
	const runnerIdHeader = request.headers.get('x-upstage-runner-id')
	const runnerId =
		typeof payload.runnerId === 'string' && payload.runnerId.length > 0
			? payload.runnerId
			: runnerIdHeader && runnerIdHeader.length > 0
				? runnerIdHeader
				: 'internal-runner'
	const heartbeatIntervalMs = parsePositiveInteger(payload.heartbeatIntervalSeconds)
	const leaseDurationMs = parsePositiveInteger(payload.leaseSeconds)

	if (jobId) {
		const run = await runQueuedGenerationJob({
			heartbeatIntervalMs: heartbeatIntervalMs ? heartbeatIntervalMs * 1000 : undefined,
			jobId,
			leaseDurationMs: leaseDurationMs ? leaseDurationMs * 1000 : undefined,
			processingMode: 'worker',
			workerId: runnerId,
		})

		return json({
			processed: 1,
			results: [run],
		})
	}

	const limit = parseLimit(payload.limit)
	const results: Array<Awaited<ReturnType<typeof processNextQueuedGenerationJob>>> = []

	for (let index = 0; index < limit; index += 1) {
		const next = await processNextQueuedGenerationJob({
			heartbeatIntervalMs: heartbeatIntervalMs ? heartbeatIntervalMs * 1000 : undefined,
			leaseDurationMs: leaseDurationMs ? leaseDurationMs * 1000 : undefined,
			processingMode: 'worker',
			workerId: runnerId,
		})

		if (!next) {
			break
		}

		results.push(next)
	}

	return json({
		processed: results.length,
		results,
	})
}
