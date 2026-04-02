import {
	getGenerationHeartbeatIntervalMs,
	getGenerationLeaseDurationMs,
	getGenerationProcessingMode,
	getGenerationWorkerBatchSize,
	getGenerationWorkerIdleExitMs,
	getGenerationWorkerPollIntervalMs,
} from '$lib/server/ai/config'
import { processNextQueuedGenerationJob } from '$lib/server/generation-jobs'
import type { GenerationWorkerCliOptions } from './generation-worker-cli'

export type GenerationWorkerRunResult = {
	idleCycles: number
	processedCount: number
	stopReason: 'idle_exit' | 'once' | 'signal'
	workerId: string
}

type NormalizedGenerationWorkerOptions = {
	batchSize: number
	heartbeatIntervalMs: number
	idleExitMs: number | null
	leaseDurationMs: number
	once: boolean
	pollIntervalMs: number
	workerId: string
}

type GenerationWorkerEvent = {
	at: string
	details?: Record<string, unknown>
	event: string
	scope: 'generation-worker'
	workerId: string
}

function wait(durationMs: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs)
	})
}

function logWorkerEvent(workerId: string, event: string, details?: Record<string, unknown>) {
	const payload: GenerationWorkerEvent = {
		at: new Date().toISOString(),
		details,
		event,
		scope: 'generation-worker',
		workerId,
	}

	console.info(JSON.stringify(payload))
}

function buildDefaultWorkerId() {
	const hostname = Bun.env.HOSTNAME || process.env.HOSTNAME || 'local-worker'

	return `generation-worker:${hostname}:${process.pid}`
}

function normalizeWorkerOptions(
	options: GenerationWorkerCliOptions = {}
): NormalizedGenerationWorkerOptions {
	return {
		batchSize: options.batchSize ?? getGenerationWorkerBatchSize(),
		heartbeatIntervalMs: options.heartbeatIntervalMs ?? getGenerationHeartbeatIntervalMs(),
		idleExitMs:
			options.idleExitMs === undefined ? getGenerationWorkerIdleExitMs() : options.idleExitMs,
		leaseDurationMs: options.leaseDurationMs ?? getGenerationLeaseDurationMs(),
		once: options.once ?? false,
		pollIntervalMs: options.pollIntervalMs ?? getGenerationWorkerPollIntervalMs(),
		workerId: options.workerId?.trim() || buildDefaultWorkerId(),
	}
}

export async function runGenerationWorker(
	options: GenerationWorkerCliOptions = {},
	shouldStop?: () => boolean
): Promise<GenerationWorkerRunResult> {
	const worker = normalizeWorkerOptions(options)
	let processedCount = 0
	let idleCycles = 0
	let idleSince = Date.now()

	logWorkerEvent(worker.workerId, 'started', {
		batchSize: worker.batchSize,
		heartbeatIntervalMs: worker.heartbeatIntervalMs,
		idleExitMs: worker.idleExitMs,
		leaseDurationMs: worker.leaseDurationMs,
		once: worker.once,
		pollIntervalMs: worker.pollIntervalMs,
		processingMode: getGenerationProcessingMode(),
	})

	while (!shouldStop?.()) {
		let processedThisCycle = 0

		for (let index = 0; index < worker.batchSize; index += 1) {
			const next = await processNextQueuedGenerationJob({
				heartbeatIntervalMs: worker.heartbeatIntervalMs,
				leaseDurationMs: worker.leaseDurationMs,
				processingMode: 'worker',
				workerId: worker.workerId,
			})

			if (!next) {
				break
			}

			processedCount += 1
			processedThisCycle += 1

			logWorkerEvent(worker.workerId, next.error ? 'job-error' : 'job-processed', {
				error: next.error,
				jobId: next.result.jobId,
				retryAttempt: next.result.retryAttempt,
				status: next.result.status,
				trigger: next.result.trigger,
			})
		}

		if (processedThisCycle > 0) {
			idleCycles = 0
			idleSince = Date.now()

			if (worker.once) {
				logWorkerEvent(worker.workerId, 'stopped', { reason: 'once' })

				return {
					idleCycles,
					processedCount,
					stopReason: 'once',
					workerId: worker.workerId,
				}
			}

			continue
		}

		if (worker.once) {
			logWorkerEvent(worker.workerId, 'stopped', { reason: 'once' })

			return {
				idleCycles,
				processedCount,
				stopReason: 'once',
				workerId: worker.workerId,
			}
		}

		idleCycles += 1

		if (worker.idleExitMs !== null && Date.now() - idleSince >= worker.idleExitMs) {
			logWorkerEvent(worker.workerId, 'stopped', {
				idleCycles,
				reason: 'idle_exit',
			})

			return {
				idleCycles,
				processedCount,
				stopReason: 'idle_exit',
				workerId: worker.workerId,
			}
		}

		await wait(worker.pollIntervalMs)
	}

	logWorkerEvent(worker.workerId, 'stopped', { reason: 'signal' })

	return {
		idleCycles,
		processedCount,
		stopReason: 'signal',
		workerId: worker.workerId,
	}
}
