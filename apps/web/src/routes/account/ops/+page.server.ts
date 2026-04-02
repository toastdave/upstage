import { getGenerationWorkerRuntimeDefaults } from '$lib/server/ai/config'
import {
	cancelStalledGenerationJob,
	processNextQueuedGenerationJob,
	runQueuedGenerationJob,
} from '$lib/server/generation-jobs'
import { loadGenerationOperationsConsole } from '$lib/server/generation-operations'
import { isOperationsConsoleEnabled } from '$lib/server/internal-api'
import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

function ensureOperationsConsole() {
	if (!isOperationsConsoleEnabled()) {
		throw error(404, 'Operations console not found')
	}
}

function buildOperatorWorkerId(userId: string) {
	return `ops-console:${userId.slice(0, 8)}`
}

function parseLimit(value: FormDataEntryValue | null) {
	if (typeof value !== 'string' || value.length === 0) {
		return 3
	}

	const parsed = Number.parseInt(value, 10)

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null
	}

	return Math.min(parsed, 10)
}

function buildProcessResultMessage(result: Awaited<ReturnType<typeof runQueuedGenerationJob>>) {
	if (result.error) {
		return `Job ${result.result.jobId} ran with an error: ${result.error}`
	}

	if (result.result.status === 'queued') {
		return `Job ${result.result.jobId} stays queued because another worker still owns it or it is waiting to be claimed.`
	}

	if (result.result.status === 'processing') {
		return `Job ${result.result.jobId} is already processing under an active worker claim.`
	}

	if (result.result.status === 'cancelled') {
		return `Job ${result.result.jobId} is already canceled.`
	}

	if (result.result.status === 'failed') {
		return `Job ${result.result.jobId} finished in a failed state. Review the failure diagnostics below.`
	}

	return `Job ${result.result.jobId} completed successfully.`
}

export const load: PageServerLoad = async ({ locals }) => {
	ensureOperationsConsole()

	if (!locals.user || !locals.session) {
		throw redirect(303, '/auth/sign-in?redirectTo=/account/ops')
	}

	return {
		operations: await loadGenerationOperationsConsole(),
		session: locals.session,
		user: locals.user,
		workerDefaults: getGenerationWorkerRuntimeDefaults(),
	}
}

export const actions: Actions = {
	processNext: async ({ locals }) => {
		ensureOperationsConsole()

		if (!locals.user) {
			throw redirect(303, '/auth/sign-in?redirectTo=/account/ops')
		}

		const next = await processNextQueuedGenerationJob({
			processingMode: 'worker',
			workerId: buildOperatorWorkerId(locals.user.id),
		})

		if (!next) {
			return {
				form: 'processNext',
				message: 'No queued jobs or expired worker leases were available to process.',
			}
		}

		return {
			form: 'processNext',
			message: buildProcessResultMessage(next),
		}
	},

	processBatch: async ({ locals, request }) => {
		ensureOperationsConsole()

		if (!locals.user) {
			throw redirect(303, '/auth/sign-in?redirectTo=/account/ops')
		}

		const formData = await request.formData()
		const limit = parseLimit(formData.get('limit'))

		if (limit === null) {
			return fail(400, {
				error: 'Choose a batch size between 1 and 10 jobs.',
				form: 'processBatch',
				values: { limit: typeof formData.get('limit') === 'string' ? formData.get('limit') : '' },
			})
		}

		let processed = 0

		for (let index = 0; index < limit; index += 1) {
			const next = await processNextQueuedGenerationJob({
				processingMode: 'worker',
				workerId: buildOperatorWorkerId(locals.user.id),
			})

			if (!next) {
				break
			}

			processed += 1
		}

		return {
			form: 'processBatch',
			message:
				processed > 0
					? `Processed ${processed} queued job${processed === 1 ? '' : 's'} from the operations console.`
					: 'No queued jobs or expired worker leases were available to process.',
			values: { limit: String(limit) },
		}
	},

	processJob: async ({ locals, request }) => {
		ensureOperationsConsole()

		if (!locals.user) {
			throw redirect(303, '/auth/sign-in?redirectTo=/account/ops')
		}

		const formData = await request.formData()
		const jobIdEntry = formData.get('generationJobId')
		const generationJobId = typeof jobIdEntry === 'string' ? jobIdEntry : ''

		if (!generationJobId) {
			return fail(400, {
				error: 'Choose a queued job before processing it manually.',
				form: 'processJob',
				values: { generationJobId },
			})
		}

		const result = await runQueuedGenerationJob({
			jobId: generationJobId,
			processingMode: 'worker',
			workerId: buildOperatorWorkerId(locals.user.id),
		})

		return {
			form: 'processJob',
			message: buildProcessResultMessage(result),
			values: { generationJobId },
		}
	},

	cancelStalledJob: async ({ locals, request }) => {
		ensureOperationsConsole()

		if (!locals.user) {
			throw redirect(303, '/auth/sign-in?redirectTo=/account/ops')
		}

		const formData = await request.formData()
		const jobIdEntry = formData.get('generationJobId')
		const generationJobId = typeof jobIdEntry === 'string' ? jobIdEntry : ''

		if (!generationJobId) {
			return fail(400, {
				error: 'Choose a stalled job before canceling it.',
				form: 'cancelStalledJob',
				values: { generationJobId },
			})
		}

		try {
			const result = await cancelStalledGenerationJob(generationJobId)

			return {
				form: 'cancelStalledJob',
				message:
					result.reason === 'already_cancelled'
						? `Job ${result.jobId} was already canceled.`
						: `Canceled stalled job ${result.jobId} and restored any reserved credits.`,
				values: { generationJobId },
			}
		} catch (actionError) {
			return fail(400, {
				error:
					actionError instanceof Error
						? actionError.message
						: 'Stalled worker cancellation failed unexpectedly.',
				form: 'cancelStalledJob',
				values: { generationJobId },
			})
		}
	},
}
