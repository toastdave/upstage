import { formatProjectType } from '$lib/projects'
import {
	getConfiguredGenerationModel,
	getGenerationCapabilities,
	getGenerationHeartbeatIntervalMs,
	getGenerationLeaseDurationMs,
	getGenerationProcessingMode,
	getGenerationRoute,
} from '$lib/server/ai/config'
import { executeImageGenerationForRoute } from '$lib/server/ai/index'
import type { GenerationProviderRoute } from '$lib/server/ai/types'
import {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	ensureUserBillingState,
	getCreditBalance,
} from '$lib/server/billing'
import { db } from '$lib/server/db'
import {
	buildGenerationAttemptKey,
	buildGenerationSubmissionKey,
	canCancelGenerationJob,
	classifyGenerationFailure,
	getGenerationBillingMetadata,
	getGenerationExecutionMetadata,
	getGenerationFailureMetadata,
	getGenerationSubmissionMetadata,
	getStoredAdditionalInstructions,
	hasExpiredGenerationWorkerLease,
	normalizeAdditionalInstructions,
	shouldTreatAsDuplicateJob,
} from '$lib/server/generation-orchestration'
import { buildGenerationPlan } from '$lib/server/generation-plan'
import {
	buildGenerationAssetStorageKey,
	buildStoredMediaUrl,
	getStoredObject,
	uploadStoredObject,
} from '$lib/server/storage'
import {
	creditLedger,
	generationImage,
	generationJob,
	generationPreset,
	project,
	sourceAsset,
} from '@upstage/db/schema'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'

type GenerationTrigger = 'manual' | 'retry'

export type ExecuteProjectGenerationResult = {
	jobId: string
	outcome: 'created' | 'duplicate'
	retryAttempt: number
	status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
	trigger: GenerationTrigger
}

type JobProcessingMode = 'request' | 'worker'

type JobProcessingLease = {
	heartbeatIntervalMs: number
	leaseDurationMs: number
	workerId: string
} | null

type ProcessQueuedGenerationJobResult = {
	error: string | null
	result: ExecuteProjectGenerationResult
}

class GenerationClaimLostError extends Error {
	constructor() {
		super('Generation job claim is no longer active.')
		this.name = 'GenerationClaimLostError'
	}
}

type GenerationExecutionSummary = Pick<
	ExecuteProjectGenerationResult,
	'jobId' | 'retryAttempt' | 'status' | 'trigger'
>

type ProcessableGenerationJobRecord = {
	aspectRatio: string
	createdAt: Date
	id: string
	model: string
	ownerUserId: string
	projectTitle: string
	prompt: string
	projectSlug: string
	projectStyleIntent: string | null
	projectType: string
	provider: GenerationProviderRoute
	requestMetadata: unknown
	responseMetadata: unknown
	sourceAssetMimeType: string
	sourceAssetStorageKey: string
	status: ExecuteProjectGenerationResult['status']
	styleLabel: string | null
}

export type GenerationOperationsSnapshot = {
	activeWorkerCount: number
	cancelledCount: number
	expiredLeaseCount: number
	failedCount: number
	latestUpdatedAt: Date | null
	oldestExpiredLeaseAt: Date | null
	oldestQueuedAt: Date | null
	processingInlineCount: number
	queuedCount: number
	succeededCount: number
}

export async function loadProjectGenerationState(projectId: string) {
	const presets = await db
		.select({
			id: generationPreset.id,
			name: generationPreset.name,
			category: generationPreset.category,
			promptTemplate: generationPreset.promptTemplate,
			defaultAspectRatio: generationPreset.defaultAspectRatio,
			slug: generationPreset.slug,
		})
		.from(generationPreset)
		.orderBy(generationPreset.isFeatured, generationPreset.name)

	const jobs = await db
		.select({
			id: generationJob.id,
			aspectRatio: generationJob.aspectRatio,
			completedAt: generationJob.completedAt,
			createdAt: generationJob.createdAt,
			creditCost: generationJob.creditCost,
			errorMessage: generationJob.errorMessage,
			model: generationJob.model,
			presetId: generationJob.presetId,
			provider: generationJob.provider,
			requestMetadata: generationJob.requestMetadata,
			responseMetadata: generationJob.responseMetadata,
			roomType: generationJob.roomType,
			startedAt: generationJob.startedAt,
			status: generationJob.status,
			styleLabel: generationJob.styleLabel,
			sourceAssetId: generationJob.sourceAssetId,
		})
		.from(generationJob)
		.where(eq(generationJob.projectId, projectId))
		.orderBy(desc(generationJob.createdAt))

	const jobImages =
		jobs.length === 0
			? []
			: await db
					.select({
						createdAt: generationImage.createdAt,
						height: generationImage.height,
						id: generationImage.id,
						isFavorite: generationImage.isFavorite,
						jobId: generationImage.jobId,
						mimeType: generationImage.mimeType,
						seed: generationImage.seed,
						sortOrder: generationImage.sortOrder,
						url: generationImage.url,
						width: generationImage.width,
					})
					.from(generationImage)
					.where(
						inArray(
							generationImage.jobId,
							jobs.map((job) => job.id)
						)
					)
					.orderBy(generationImage.sortOrder, generationImage.createdAt)

	const imagesByJobId = new Map<string, typeof jobImages>()
	const sourceAssets =
		jobs.length === 0
			? []
			: await db
					.select({
						id: sourceAsset.id,
						originalFilename: sourceAsset.originalFilename,
						roomBriefStatus: sourceAsset.roomBriefStatus,
						roomBriefSummary: sourceAsset.roomBriefSummary,
						url: sourceAsset.url,
						width: sourceAsset.width,
						height: sourceAsset.height,
					})
					.from(sourceAsset)
					.where(
						inArray(
							sourceAsset.id,
							jobs.map((job) => job.sourceAssetId)
						)
					)

	const sourceAssetById = new Map(sourceAssets.map((asset) => [asset.id, asset]))

	for (const image of jobImages) {
		const existing = imagesByJobId.get(image.jobId) ?? []
		existing.push(image)
		imagesByJobId.set(image.jobId, existing)
	}

	return {
		capabilities: getGenerationCapabilities(),
		generationRoute: getGenerationRoute(),
		jobs: jobs.map((job) => ({
			...job,
			billing: getGenerationBillingMetadata(job.responseMetadata),
			canCancel:
				canCancelGenerationJob(job.status) || hasExpiredGenerationWorkerLease(job.responseMetadata),
			execution: getGenerationExecutionMetadata(job.responseMetadata),
			failure: getGenerationFailureMetadata(job.responseMetadata),
			images: imagesByJobId.get(job.id) ?? [],
			submission: getGenerationSubmissionMetadata(job.requestMetadata),
			sourceAsset: sourceAssetById.get(job.sourceAssetId) ?? null,
		})),
		presets,
	}
}

export async function loadGenerationOperationsSnapshot(): Promise<GenerationOperationsSnapshot> {
	const [snapshot] = await db
		.select({
			activeWorkerCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'processing' and (${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker' and ((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) > now() then 1 else 0 end), 0)`,
			cancelledCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'cancelled' then 1 else 0 end), 0)`,
			expiredLeaseCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'processing' and (${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker' and (${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null and ((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) <= now() then 1 else 0 end), 0)`,
			failedCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'failed' then 1 else 0 end), 0)`,
			latestUpdatedAt: sql<Date | null>`max(${generationJob.updatedAt})`,
			oldestExpiredLeaseAt: sql<Date | null>`min(case when ${generationJob.status} = 'processing' and (${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker' and (${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null and ((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) <= now() then ${generationJob.updatedAt} else null end)`,
			oldestQueuedAt: sql<Date | null>`min(case when ${generationJob.status} = 'queued' then ${generationJob.createdAt} else null end)`,
			processingInlineCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'processing' and coalesce(${generationJob.responseMetadata} -> 'execution' ->> 'processingMode', 'request') = 'request' then 1 else 0 end), 0)`,
			queuedCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'queued' then 1 else 0 end), 0)`,
			succeededCount: sql<number>`coalesce(sum(case when ${generationJob.status} = 'succeeded' then 1 else 0 end), 0)`,
		})
		.from(generationJob)

	return {
		activeWorkerCount: Number(snapshot?.activeWorkerCount ?? 0),
		cancelledCount: Number(snapshot?.cancelledCount ?? 0),
		expiredLeaseCount: Number(snapshot?.expiredLeaseCount ?? 0),
		failedCount: Number(snapshot?.failedCount ?? 0),
		latestUpdatedAt: snapshot?.latestUpdatedAt ?? null,
		oldestExpiredLeaseAt: snapshot?.oldestExpiredLeaseAt ?? null,
		oldestQueuedAt: snapshot?.oldestQueuedAt ?? null,
		processingInlineCount: Number(snapshot?.processingInlineCount ?? 0),
		queuedCount: Number(snapshot?.queuedCount ?? 0),
		succeededCount: Number(snapshot?.succeededCount ?? 0),
	}
}

function updateExecutionMetadata(
	responseMetadata: Record<string, unknown>,
	patch: Record<string, unknown>
) {
	return {
		...responseMetadata,
		execution: {
			...(responseMetadata.execution as Record<string, unknown>),
			...patch,
		},
	} satisfies Record<string, unknown>
}

function updateBillingMetadata(
	responseMetadata: Record<string, unknown>,
	patch: Record<string, unknown>
) {
	return {
		...responseMetadata,
		billing: {
			...(responseMetadata.billing as Record<string, unknown>),
			...patch,
		},
	} satisfies Record<string, unknown>
}

function buildCancellationResponseMetadata(options: {
	cancelledAt: Date
	cancellationReason: string
	persistedResponseMetadata: Record<string, unknown>
	refundedCredits: number
	balanceAfterRefund: number | null
	refundReferenceId: string
}) {
	const totalDurationMs = Date.parse(
		String((options.persistedResponseMetadata.execution as Record<string, unknown>).acceptedAt)
	)

	return {
		...updateBillingMetadata(options.persistedResponseMetadata, {
			balanceAfterRefund: options.balanceAfterRefund,
			refundReferenceId: options.refundReferenceId,
			refundedCredits: options.refundedCredits,
		}),
		execution: {
			...(options.persistedResponseMetadata.execution as Record<string, unknown>),
			cancelledAt: options.cancelledAt.toISOString(),
			cancellationReason: options.cancellationReason,
			completedAt: options.cancelledAt.toISOString(),
			workerLeaseExpiresAt: null,
			totalDurationMs: Number.isFinite(totalDurationMs)
				? options.cancelledAt.getTime() - totalDurationMs
				: null,
		},
	} satisfies Record<string, unknown>
}

function buildExecutionSummary(
	job: Pick<ProcessableGenerationJobRecord, 'id' | 'requestMetadata' | 'status'>
): GenerationExecutionSummary {
	const submission = getGenerationSubmissionMetadata(job.requestMetadata)

	return {
		jobId: job.id,
		retryAttempt: submission.retryAttempt ?? 1,
		status: job.status,
		trigger: submission.trigger ?? 'manual',
	}
}

function isClaimableGenerationJob(job: ProcessableGenerationJobRecord) {
	return (
		job.status === 'queued' ||
		(job.status === 'processing' && hasExpiredGenerationWorkerLease(job.responseMetadata))
	)
}

function buildProcessingJobClaimCondition(options: {
	claimToken: string
	jobId: string
	processingMode: JobProcessingMode
	status: ProcessableGenerationJobRecord['status']
}) {
	if (options.status === 'queued') {
		return and(eq(generationJob.id, options.jobId), eq(generationJob.status, 'queued'))
	}

	return and(
		eq(generationJob.id, options.jobId),
		eq(generationJob.status, 'processing'),
		sql`(${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = ${options.processingMode}`,
		sql`(${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null`,
		sql`((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) <= now()`,
		sql`coalesce(${generationJob.responseMetadata} -> 'execution' ->> 'workerClaimToken', '') <> ${options.claimToken}`
	)
}

function buildActiveClaimCondition(jobId: string, claimToken: string) {
	return and(
		eq(generationJob.id, jobId),
		eq(generationJob.status, 'processing'),
		sql`(${generationJob.responseMetadata} -> 'execution' ->> 'workerClaimToken') = ${claimToken}`
	)
}

function buildExpiredWorkerLeaseCondition() {
	return and(
		eq(generationJob.status, 'processing'),
		sql`(${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker'`,
		sql`(${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null`,
		sql`((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) <= now()`
	)
}

function getStoredRoomBrief(requestMetadata: unknown) {
	if (!requestMetadata || typeof requestMetadata !== 'object') {
		return null
	}

	const roomBrief = 'roomBrief' in requestMetadata ? requestMetadata.roomBrief : null

	return roomBrief && typeof roomBrief === 'object' ? (roomBrief as Record<string, unknown>) : null
}

function getStoredWorkflowLabel(roomBrief: Record<string, unknown> | null, projectType: string) {
	return typeof roomBrief?.intent === 'string' && roomBrief.intent.length > 0
		? roomBrief.intent
		: formatProjectType(projectType)
}

function getStoredPresetName(roomBrief: Record<string, unknown> | null, styleLabel: string | null) {
	if (typeof roomBrief?.preset === 'string' && roomBrief.preset.length > 0) {
		return roomBrief.preset
	}

	return styleLabel ?? 'Generated concept'
}

async function loadProcessableGenerationJob(jobId: string) {
	const [jobRecord] = await db
		.select({
			aspectRatio: generationJob.aspectRatio,
			createdAt: generationJob.createdAt,
			id: generationJob.id,
			model: generationJob.model,
			ownerUserId: project.ownerUserId,
			projectSlug: project.slug,
			projectStyleIntent: project.styleIntent,
			projectTitle: project.title,
			projectType: project.projectType,
			prompt: generationJob.prompt,
			provider: generationJob.provider,
			requestMetadata: generationJob.requestMetadata,
			responseMetadata: generationJob.responseMetadata,
			sourceAssetMimeType: sourceAsset.mimeType,
			sourceAssetStorageKey: sourceAsset.storageKey,
			status: generationJob.status,
			styleLabel: generationJob.styleLabel,
		})
		.from(generationJob)
		.innerJoin(project, eq(project.id, generationJob.projectId))
		.innerJoin(sourceAsset, eq(sourceAsset.id, generationJob.sourceAssetId))
		.where(eq(generationJob.id, jobId))
		.limit(1)

	if (!jobRecord) {
		throw new Error('Generation job not found')
	}

	return {
		...jobRecord,
		provider: jobRecord.provider as GenerationProviderRoute,
	} satisfies ProcessableGenerationJobRecord
}

async function loadGenerationExecutionSummary(jobId: string): Promise<GenerationExecutionSummary> {
	const jobRecord = await loadProcessableGenerationJob(jobId)

	return buildExecutionSummary(jobRecord)
}

async function claimQueuedGenerationJob(options: {
	job: ProcessableGenerationJobRecord
	lease: JobProcessingLease
	processingMode: JobProcessingMode
}) {
	const acceptedAt = getGenerationExecutionMetadata(options.job.responseMetadata).acceptedAt
	const acceptedAtMs = acceptedAt ? Date.parse(acceptedAt) : options.job.createdAt.getTime()
	const processingStartedAt = new Date()
	const queueDurationMs =
		processingStartedAt.getTime() -
		(Number.isFinite(acceptedAtMs) ? acceptedAtMs : options.job.createdAt.getTime())
	const persistedResponseMetadata =
		options.job.responseMetadata && typeof options.job.responseMetadata === 'object'
			? (options.job.responseMetadata as Record<string, unknown>)
			: {}
	const claimToken = options.lease ? crypto.randomUUID() : null
	const claimedResponseMetadata = updateExecutionMetadata(persistedResponseMetadata, {
		lastHeartbeatAt: options.lease ? processingStartedAt.toISOString() : null,
		processingMode: options.processingMode,
		queueDurationMs,
		startedAt: processingStartedAt.toISOString(),
		workerClaimToken: claimToken,
		workerId: options.lease?.workerId ?? null,
		workerLeaseExpiresAt: options.lease
			? new Date(processingStartedAt.getTime() + options.lease.leaseDurationMs).toISOString()
			: null,
	})

	const [claimedJob] = await db
		.update(generationJob)
		.set({
			startedAt: processingStartedAt,
			status: 'processing',
			updatedAt: processingStartedAt,
			responseMetadata: claimedResponseMetadata,
		})
		.where(
			buildProcessingJobClaimCondition({
				claimToken: claimToken ?? '',
				jobId: options.job.id,
				processingMode: options.processingMode,
				status: options.job.status,
			})
		)
		.returning({ id: generationJob.id })

	return claimedJob
		? {
				acceptedAtMs:
					Number.isFinite(acceptedAtMs) && acceptedAtMs > 0
						? acceptedAtMs
						: options.job.createdAt.getTime(),
				claimToken,
				claimedResponseMetadata,
				processingStartedAt,
				queueDurationMs,
			}
		: null
}

function startGenerationJobHeartbeat(options: {
	claimToken: string | null
	jobId: string
	lease: JobProcessingLease
	processingMode: JobProcessingMode
	processingStartedAt: Date
	queueDurationMs: number
	responseMetadata: Record<string, unknown>
}) {
	if (!options.lease) {
		return {
			stop: async () => {},
		}
	}

	const lease = options.lease

	let active = true
	let running = false

	const tick = async () => {
		if (!active || running) {
			return
		}

		running = true
		const heartbeatAt = new Date()
		const workerLeaseExpiresAt = new Date(
			heartbeatAt.getTime() + lease.leaseDurationMs
		).toISOString()

		try {
			const [updatedJob] = await db
				.update(generationJob)
				.set({
					updatedAt: heartbeatAt,
					responseMetadata: updateExecutionMetadata(options.responseMetadata, {
						lastHeartbeatAt: heartbeatAt.toISOString(),
						processingMode: options.processingMode,
						queueDurationMs: options.queueDurationMs,
						startedAt: options.processingStartedAt.toISOString(),
						workerId: lease.workerId,
						workerLeaseExpiresAt,
					}),
				})
				.where(buildActiveClaimCondition(options.jobId, options.claimToken ?? ''))
				.returning({ id: generationJob.id })

			if (!updatedJob) {
				active = false
			}
		} finally {
			running = false
		}
	}

	const interval = setInterval(() => {
		void tick()
	}, lease.heartbeatIntervalMs)

	return {
		stop: async () => {
			active = false
			clearInterval(interval)
		},
	}
}

async function runGenerationJob(options: {
	acceptedAtMs: number
	claimToken: string | null
	job: ProcessableGenerationJobRecord
	lease: JobProcessingLease
	responseMetadata: Record<string, unknown>
	processingMode: JobProcessingMode
	processingStartedAt: Date
	queueDurationMs: number
}): Promise<ExecuteProjectGenerationResult> {
	const roomBrief = getStoredRoomBrief(options.job.requestMetadata)

	if (!roomBrief) {
		throw new Error('Stored room brief is missing for this generation job.')
	}

	const submission = getGenerationSubmissionMetadata(options.job.requestMetadata)
	const sourceObject = await getStoredObject(options.job.sourceAssetStorageKey)

	if (!sourceObject.Body) {
		throw new Error('Source image contents are missing from storage')
	}

	const heartbeat = startGenerationJobHeartbeat({
		claimToken: options.claimToken,
		jobId: options.job.id,
		lease: options.lease,
		processingMode: options.processingMode,
		processingStartedAt: options.processingStartedAt,
		queueDurationMs: options.queueDurationMs,
		responseMetadata: options.responseMetadata,
	})

	const sourceBuffer = new Uint8Array(await sourceObject.Body.transformToByteArray())
	try {
		const executionResult = await executeImageGenerationForRoute(options.job.provider, {
			additionalInstructions: submission.additionalInstructions,
			aspectRatio: options.job.aspectRatio,
			compiledPrompt: options.job.prompt,
			jobId: options.job.id,
			presetName: getStoredPresetName(roomBrief, options.job.styleLabel),
			projectSlug: options.job.projectSlug,
			protectedElements:
				typeof roomBrief.protectedElements === 'string' ? roomBrief.protectedElements : null,
			requestedCount: 1,
			sourceImage: {
				data: sourceBuffer,
				mimeType: options.job.sourceAssetMimeType,
				storageKey: options.job.sourceAssetStorageKey,
			},
			styleIntent: options.job.projectStyleIntent,
			userId: options.job.ownerUserId,
			workflowLabel: getStoredWorkflowLabel(roomBrief, options.job.projectType),
			workflowType: options.job.projectType,
			roomBrief,
		})

		for (const image of executionResult.images) {
			const storageKey = buildGenerationAssetStorageKey(
				options.job.projectSlug,
				options.job.id,
				image.sortOrder,
				image.mimeType
			)

			await uploadStoredObject({
				body: image.data,
				cacheControl: 'private, max-age=3600',
				contentType: image.mimeType,
				storageKey,
			})

			await db.insert(generationImage).values({
				jobId: options.job.id,
				storageKey,
				url: buildStoredMediaUrl(storageKey),
				mimeType: image.mimeType,
				revisedPrompt: image.revisedPrompt ?? null,
				seed: image.seed ?? null,
				width: image.width ?? null,
				height: image.height ?? null,
				sortOrder: image.sortOrder,
			})
		}

		const completedAt = new Date()
		const runDurationMs = completedAt.getTime() - options.processingStartedAt.getTime()
		const totalDurationMs = completedAt.getTime() - options.acceptedAtMs

		const [completedJob] = await db
			.update(generationJob)
			.set({
				provider: executionResult.providerRoute,
				model: executionResult.model,
				providerGenerationId: executionResult.providerGenerationId ?? null,
				requestMetadata: {
					...(options.job.requestMetadata as Record<string, unknown>),
					providerRequest: executionResult.requestMetadata,
				},
				responseMetadata: {
					...executionResult.responseMetadata,
					billing: getGenerationBillingMetadata(options.job.responseMetadata),
					execution: {
						...(options.responseMetadata.execution as Record<string, unknown>),
						completedAt: completedAt.toISOString(),
						imageCount: executionResult.images.length,
						lastHeartbeatAt: options.lease ? completedAt.toISOString() : null,
						processingMode: options.processingMode,
						queueDurationMs: options.queueDurationMs,
						runDurationMs,
						startedAt: options.processingStartedAt.toISOString(),
						totalDurationMs,
						workerLeaseExpiresAt: null,
					},
					warnings: executionResult.warnings ?? [],
				},
				status: 'succeeded',
				completedAt,
				updatedAt: completedAt,
			})
			.where(
				options.claimToken
					? buildActiveClaimCondition(options.job.id, options.claimToken)
					: eq(generationJob.id, options.job.id)
			)
			.returning({ id: generationJob.id })

		if (!completedJob) {
			throw new GenerationClaimLostError()
		}

		const summary = buildExecutionSummary({
			id: options.job.id,
			requestMetadata: options.job.requestMetadata,
			status: 'succeeded',
		})

		return {
			jobId: summary.jobId,
			outcome: 'created',
			retryAttempt: summary.retryAttempt,
			status: summary.status,
			trigger: summary.trigger,
		}
	} finally {
		await heartbeat.stop()
	}
}

export async function processQueuedGenerationJob(options: {
	heartbeatIntervalMs?: number
	jobId: string
	leaseDurationMs?: number
	processingMode?: JobProcessingMode
	workerId?: string
}): Promise<ExecuteProjectGenerationResult> {
	const processingMode = options.processingMode ?? 'worker'
	const lease =
		processingMode === 'worker'
			? {
					heartbeatIntervalMs: options.heartbeatIntervalMs ?? getGenerationHeartbeatIntervalMs(),
					leaseDurationMs: options.leaseDurationMs ?? getGenerationLeaseDurationMs(),
					workerId: options.workerId ?? 'internal-runner',
				}
			: null
	const job = await loadProcessableGenerationJob(options.jobId)
	const summary = buildExecutionSummary(job)

	if (!isClaimableGenerationJob(job)) {
		return {
			jobId: summary.jobId,
			outcome: 'created',
			retryAttempt: summary.retryAttempt,
			status: summary.status,
			trigger: summary.trigger,
		}
	}

	const claim = await claimQueuedGenerationJob({ job, lease, processingMode })

	if (!claim) {
		const current = await loadGenerationExecutionSummary(options.jobId)

		return {
			jobId: current.jobId,
			outcome: 'created',
			retryAttempt: current.retryAttempt,
			status: current.status,
			trigger: current.trigger,
		}
	}

	try {
		return await runGenerationJob({
			acceptedAtMs: claim.acceptedAtMs,
			claimToken: claim.claimToken,
			job,
			lease,
			responseMetadata: claim.claimedResponseMetadata,
			processingMode,
			processingStartedAt: claim.processingStartedAt,
			queueDurationMs: claim.queueDurationMs,
		})
	} catch (error) {
		const failure = classifyGenerationFailure(error)
		const completedAt = new Date()
		const runDurationMs = completedAt.getTime() - claim.processingStartedAt.getTime()
		const totalDurationMs = completedAt.getTime() - claim.acceptedAtMs
		const billingMetadata = getGenerationBillingMetadata(job.responseMetadata)
		const refundReferenceId = billingMetadata.refundReferenceId ?? `generation:${job.id}:refund`

		if (error instanceof GenerationClaimLostError) {
			const current = await loadGenerationExecutionSummary(options.jobId)

			return {
				jobId: current.jobId,
				outcome: 'created',
				retryAttempt: current.retryAttempt,
				status: current.status,
				trigger: current.trigger,
			}
		}

		const resultFromClaimError = await db
			.transaction(async (tx) => {
				const [existingRefund] = await tx
					.select({ id: creditLedger.id })
					.from(creditLedger)
					.where(
						and(
							eq(creditLedger.referenceId, refundReferenceId),
							eq(creditLedger.userId, job.ownerUserId)
						)
					)
					.limit(1)

				let refundedCredits = 0
				let balanceAfterRefund: number | null = null

				if (!existingRefund) {
					const creditBalance = await getCreditBalance(tx, job.ownerUserId)
					refundedCredits = billingMetadata.chargedCredits ?? 0
					balanceAfterRefund = creditBalance + refundedCredits

					if (refundedCredits > 0) {
						await tx.insert(creditLedger).values({
							amount: refundedCredits,
							balanceAfter: balanceAfterRefund,
							description: buildGenerationRefundDescription(job.projectTitle),
							entryType: 'refund',
							referenceId: refundReferenceId,
							userId: job.ownerUserId,
						})
					}
				}

				const [failedJob] = await tx
					.update(generationJob)
					.set({
						completedAt,
						errorMessage: failure.message,
						responseMetadata: {
							...updateBillingMetadata(claim.claimedResponseMetadata, {
								balanceAfterRefund,
								refundReferenceId,
								refundedCredits,
							}),
							execution: {
								...(claim.claimedResponseMetadata.execution as Record<string, unknown>),
								completedAt: completedAt.toISOString(),
								lastHeartbeatAt: lease ? completedAt.toISOString() : null,
								processingMode,
								queueDurationMs: claim.queueDurationMs,
								runDurationMs,
								startedAt: claim.processingStartedAt.toISOString(),
								totalDurationMs,
								workerLeaseExpiresAt: null,
							},
							failure: {
								...failure,
								failedAt: completedAt.toISOString(),
							},
						},
						status: 'failed',
						updatedAt: completedAt,
					})
					.where(
						claim.claimToken
							? buildActiveClaimCondition(job.id, claim.claimToken)
							: eq(generationJob.id, job.id)
					)
					.returning({ id: generationJob.id })

				if (!failedJob) {
					throw new GenerationClaimLostError()
				}
			})
			.catch(async (claimError) => {
				if (claimError instanceof GenerationClaimLostError) {
					const current = await loadGenerationExecutionSummary(options.jobId)

					return {
						jobId: current.jobId,
						outcome: 'created' as const,
						retryAttempt: current.retryAttempt,
						status: current.status,
						trigger: current.trigger,
					}
				}

				throw claimError
			})

		if (resultFromClaimError) {
			return resultFromClaimError
		}

		throw error
	}
}

export async function runQueuedGenerationJob(options: {
	heartbeatIntervalMs?: number
	jobId: string
	leaseDurationMs?: number
	processingMode?: JobProcessingMode
	workerId?: string
}): Promise<ProcessQueuedGenerationJobResult> {
	try {
		return {
			error: null,
			result: await processQueuedGenerationJob(options),
		}
	} catch (error) {
		const result = await loadGenerationExecutionSummary(options.jobId)

		return {
			error: error instanceof Error ? error.message : 'Generation processing failed unexpectedly.',
			result: {
				jobId: result.jobId,
				outcome: 'created',
				retryAttempt: result.retryAttempt,
				status: result.status,
				trigger: result.trigger,
			},
		}
	}
}

export async function processNextQueuedGenerationJob(options?: {
	heartbeatIntervalMs?: number
	leaseDurationMs?: number
	processingMode?: JobProcessingMode
	workerId?: string
}): Promise<ProcessQueuedGenerationJobResult | null> {
	const [claimableJob] = await db
		.select({ id: generationJob.id })
		.from(generationJob)
		.where(or(eq(generationJob.status, 'queued'), buildExpiredWorkerLeaseCondition()))
		.orderBy(
			asc(sql<number>`case when ${generationJob.status} = 'queued' then 0 else 1 end`),
			generationJob.createdAt
		)
		.limit(1)

	if (!claimableJob) {
		return null
	}

	return runQueuedGenerationJob({
		heartbeatIntervalMs: options?.heartbeatIntervalMs,
		jobId: claimableJob.id,
		leaseDurationMs: options?.leaseDurationMs,
		processingMode: options?.processingMode,
		workerId: options?.workerId,
	})
}

export async function executeProjectGeneration(options: {
	additionalInstructions: string | null
	aspectRatio: string
	presetId: string
	projectSlug: string
	sourceAssetId: string
	trigger?: GenerationTrigger
	userId: string
	retryOfJobId?: string
}): Promise<ExecuteProjectGenerationResult> {
	const trigger = options.trigger ?? 'manual'
	const [projectRecord] = await db
		.select()
		.from(project)
		.where(and(eq(project.slug, options.projectSlug), eq(project.ownerUserId, options.userId)))
		.limit(1)

	if (!projectRecord) {
		throw new Error('Project not found')
	}

	const [sourceAssetRecord] = await db
		.select()
		.from(sourceAsset)
		.where(
			and(
				eq(sourceAsset.id, options.sourceAssetId),
				eq(sourceAsset.projectId, projectRecord.id),
				eq(sourceAsset.ownerUserId, options.userId),
				isNull(sourceAsset.archivedAt)
			)
		)
		.limit(1)

	if (!sourceAssetRecord) {
		throw new Error('Source photo not found')
	}

	const [presetRecord] = await db
		.select()
		.from(generationPreset)
		.where(eq(generationPreset.id, options.presetId))
		.limit(1)

	if (!presetRecord || presetRecord.category !== projectRecord.projectType) {
		throw new Error('Preset not found for this project workflow')
	}

	const normalizedAdditionalInstructions = normalizeAdditionalInstructions(
		options.additionalInstructions
	)
	const generationPlan = buildGenerationPlan({
		additionalInstructions: normalizedAdditionalInstructions,
		aspectRatio: options.aspectRatio,
		preset: presetRecord,
		project: projectRecord,
		roomBrief: sourceAssetRecord.roomBrief,
		roomBriefStatus: sourceAssetRecord.roomBriefStatus,
		sourceAsset: sourceAssetRecord,
	})

	const provider = getGenerationRoute()
	const model = getConfiguredGenerationModel(provider)
	const submissionKey = buildGenerationSubmissionKey({
		additionalInstructions: normalizedAdditionalInstructions,
		aspectRatio: options.aspectRatio,
		model,
		presetId: presetRecord.id,
		projectId: projectRecord.id,
		provider,
		prompt: generationPlan.compiledPrompt,
		sourceAssetId: sourceAssetRecord.id,
		userId: options.userId,
	})
	const createdJobId = crypto.randomUUID()
	const chargeReferenceId = `generation:${createdJobId}:charge`
	const projectTitle = projectRecord.title
	let retryAttempt = 1
	let createdJob: { id: string } | undefined
	const acceptedAt = new Date()
	const baseRequestMetadata = {
		roomBrief: generationPlan.roomBrief,
		submission: {
			additionalInstructions: normalizedAdditionalInstructions,
			aspectRatio: options.aspectRatio,
			presetId: presetRecord.id,
			presetName: presetRecord.name,
			retryAttempt: 1,
			retryOfJobId: options.retryOfJobId ?? null,
			sourceAssetId: sourceAssetRecord.id,
			submissionKey,
			submittedAt: acceptedAt.toISOString(),
			trigger,
		},
	} satisfies Record<string, unknown>
	const baseResponseMetadata = {
		billing: {
			balanceAfterCharge: null,
			chargeReferenceId,
			chargedCredits: generationPlan.creditEstimate,
			refundReferenceId: null,
			refundedCredits: 0,
		},
		execution: {
			acceptedAt: acceptedAt.toISOString(),
			retryAttempt: 1,
			retryOfJobId: options.retryOfJobId ?? null,
			trigger,
		},
	} satisfies Record<string, unknown>

	try {
		const creationResult = await db.transaction(async (tx) => {
			await ensureUserBillingState(tx, options.userId)

			const matchingJobs = await tx
				.select({
					completedAt: generationJob.completedAt,
					createdAt: generationJob.createdAt,
					id: generationJob.id,
					status: generationJob.status,
				})
				.from(generationJob)
				.where(
					and(
						eq(generationJob.projectId, projectRecord.id),
						eq(generationJob.sourceAssetId, sourceAssetRecord.id),
						eq(generationJob.presetId, presetRecord.id),
						eq(generationJob.aspectRatio, options.aspectRatio),
						eq(generationJob.provider, provider),
						eq(generationJob.model, model),
						eq(generationJob.prompt, generationPlan.compiledPrompt)
					)
				)
				.orderBy(desc(generationJob.createdAt))

			const duplicateJob = matchingJobs.find((job) => shouldTreatAsDuplicateJob(job))

			if (duplicateJob) {
				return {
					result: {
						jobId: duplicateJob.id,
						outcome: 'duplicate' as const,
						retryAttempt: matchingJobs.length,
						status: duplicateJob.status,
						trigger,
					},
					type: 'duplicate' as const,
				}
			}

			retryAttempt = matchingJobs.length + 1
			const idempotencyKey = buildGenerationAttemptKey(submissionKey, retryAttempt)
			const creditBalance = await getCreditBalance(tx, options.userId)

			if (creditBalance < generationPlan.creditEstimate) {
				throw new Error(
					buildInsufficientCreditsMessage(creditBalance, generationPlan.creditEstimate)
				)
			}

			const requestMetadata = {
				...baseRequestMetadata,
				submission: {
					...(baseRequestMetadata.submission as Record<string, unknown>),
					retryAttempt,
				},
			} satisfies Record<string, unknown>
			const responseMetadata = {
				...baseResponseMetadata,
				billing: {
					...(baseResponseMetadata.billing as Record<string, unknown>),
					balanceAfterCharge: creditBalance - generationPlan.creditEstimate,
				},
				execution: {
					...(baseResponseMetadata.execution as Record<string, unknown>),
					retryAttempt,
				},
			} satisfies Record<string, unknown>
			;[createdJob] = await tx
				.insert(generationJob)
				.values({
					id: createdJobId,
					projectId: projectRecord.id,
					sourceAssetId: sourceAssetRecord.id,
					presetId: presetRecord.id,
					status: 'queued',
					provider,
					model,
					prompt: generationPlan.compiledPrompt,
					styleLabel: projectRecord.styleIntent ?? presetRecord.name,
					roomType: projectRecord.roomType,
					aspectRatio: options.aspectRatio,
					requestedCount: 1,
					creditCost: generationPlan.creditEstimate,
					idempotencyKey,
					requestMetadata: requestMetadata,
					responseMetadata: responseMetadata,
				})
				.returning({ id: generationJob.id })

			await tx.insert(creditLedger).values({
				amount: -generationPlan.creditEstimate,
				balanceAfter: creditBalance - generationPlan.creditEstimate,
				description: buildGenerationChargeDescription(projectTitle),
				entryType: 'generation',
				referenceId: chargeReferenceId,
				userId: options.userId,
			})

			return {
				result: {
					jobId: createdJobId,
					outcome: 'created' as const,
					retryAttempt,
					status: 'queued' as const,
					trigger,
				},
				type: 'created' as const,
			}
		})

		if (creationResult.type === 'duplicate') {
			return creationResult.result
		}
	} catch (error) {
		const idempotencyKey = buildGenerationAttemptKey(submissionKey, retryAttempt)
		const [existingJob] = await db
			.select({
				id: generationJob.id,
				status: generationJob.status,
			})
			.from(generationJob)
			.where(eq(generationJob.idempotencyKey, idempotencyKey))
			.limit(1)

		if (existingJob) {
			return {
				jobId: existingJob.id,
				outcome: 'duplicate',
				retryAttempt,
				status: existingJob.status,
				trigger,
			}
		}

		throw error
	}

	if (!createdJob) {
		throw new Error('Generation job could not be created')
	}

	const acceptedJobId = createdJob.id

	if (getGenerationProcessingMode() === 'deferred') {
		return {
			jobId: acceptedJobId,
			outcome: 'created',
			retryAttempt,
			status: 'queued',
			trigger,
		}
	}

	return processQueuedGenerationJob({
		jobId: acceptedJobId,
		processingMode: 'request',
	})
}

export async function cancelProjectGeneration(options: {
	jobId: string
	projectSlug: string
	userId: string
}) {
	const [jobRecord] = await db
		.select({
			id: generationJob.id,
			responseMetadata: generationJob.responseMetadata,
			status: generationJob.status,
			title: project.title,
		})
		.from(generationJob)
		.innerJoin(project, eq(project.id, generationJob.projectId))
		.where(
			and(
				eq(generationJob.id, options.jobId),
				eq(project.ownerUserId, options.userId),
				eq(project.slug, options.projectSlug)
			)
		)
		.limit(1)

	if (!jobRecord) {
		throw new Error('Generation job not found')
	}

	if (jobRecord.status === 'cancelled') {
		return {
			jobId: jobRecord.id,
			reason: 'already_cancelled' as const,
			status: 'cancelled' as const,
		}
	}

	const canCancelExpiredWorkerLease =
		jobRecord.status === 'processing' && hasExpiredGenerationWorkerLease(jobRecord.responseMetadata)

	if (jobRecord.status === 'processing' && !canCancelExpiredWorkerLease) {
		throw new Error('This run already started processing and can no longer be canceled.')
	}

	if (jobRecord.status !== 'queued' && !canCancelExpiredWorkerLease) {
		throw new Error('Only queued jobs or stalled worker runs can be canceled.')
	}

	const persistedResponseMetadata =
		jobRecord.responseMetadata && typeof jobRecord.responseMetadata === 'object'
			? (jobRecord.responseMetadata as Record<string, unknown>)
			: {}
	const refundReferenceId =
		getGenerationBillingMetadata(jobRecord.responseMetadata).refundReferenceId ??
		`generation:${jobRecord.id}:refund`
	const refundedCredits =
		getGenerationBillingMetadata(jobRecord.responseMetadata).chargedCredits ?? 0
	const cancelledAt = new Date()

	return db.transaction(async (tx) => {
		const [claimedCancellation] = await tx
			.update(generationJob)
			.set({
				completedAt: cancelledAt,
				errorMessage: canCancelExpiredWorkerLease
					? 'Generation was canceled after the deferred worker lease expired.'
					: 'Generation was canceled before provider execution started.',
				status: 'cancelled',
				updatedAt: cancelledAt,
			})
			.where(
				or(
					and(eq(generationJob.id, jobRecord.id), eq(generationJob.status, 'queued')),
					and(eq(generationJob.id, jobRecord.id), buildExpiredWorkerLeaseCondition())
				)
			)
			.returning({ id: generationJob.id })

		if (!claimedCancellation) {
			const [currentJob] = await tx
				.select({ status: generationJob.status })
				.from(generationJob)
				.where(eq(generationJob.id, jobRecord.id))
				.limit(1)

			if (currentJob?.status === 'cancelled') {
				return {
					jobId: jobRecord.id,
					reason: 'already_cancelled' as const,
					status: 'cancelled' as const,
				}
			}

			if (currentJob?.status === 'processing') {
				throw new Error('Only queued jobs or worker runs with expired leases can be canceled.')
			}

			throw new Error('Only queued jobs or stalled worker runs can be canceled.')
		}

		const [existingRefund] = await tx
			.select({ id: creditLedger.id })
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.referenceId, refundReferenceId),
					eq(creditLedger.userId, options.userId)
				)
			)
			.limit(1)

		let creditedAmount = 0
		let balanceAfterRefund: number | null = null

		if (!existingRefund && refundedCredits > 0) {
			const creditBalance = await getCreditBalance(tx, options.userId)
			creditedAmount = refundedCredits
			balanceAfterRefund = creditBalance + refundedCredits

			await tx.insert(creditLedger).values({
				amount: refundedCredits,
				balanceAfter: balanceAfterRefund,
				description: buildGenerationRefundDescription(jobRecord.title),
				entryType: 'refund',
				referenceId: refundReferenceId,
				userId: options.userId,
			})
		}

		await tx
			.update(generationJob)
			.set({
				responseMetadata: buildCancellationResponseMetadata({
					balanceAfterRefund,
					cancelledAt,
					cancellationReason: canCancelExpiredWorkerLease
						? 'expired_worker_lease'
						: 'user_requested',
					persistedResponseMetadata,
					refundReferenceId,
					refundedCredits: creditedAmount,
				}),
			})
			.where(eq(generationJob.id, jobRecord.id))

		return {
			jobId: jobRecord.id,
			reason: canCancelExpiredWorkerLease ? ('expired_worker_lease' as const) : ('queued' as const),
			status: 'cancelled' as const,
		}
	})
}

export async function cancelStalledGenerationJob(jobId: string) {
	const [jobRecord] = await db
		.select({
			id: generationJob.id,
			ownerUserId: project.ownerUserId,
			projectSlug: project.slug,
			responseMetadata: generationJob.responseMetadata,
			status: generationJob.status,
			title: project.title,
		})
		.from(generationJob)
		.innerJoin(project, eq(project.id, generationJob.projectId))
		.where(eq(generationJob.id, jobId))
		.limit(1)

	if (!jobRecord) {
		throw new Error('Generation job not found')
	}

	if (jobRecord.status === 'cancelled') {
		return {
			jobId: jobRecord.id,
			projectSlug: jobRecord.projectSlug,
			reason: 'already_cancelled' as const,
			status: 'cancelled' as const,
		}
	}

	if (
		jobRecord.status !== 'processing' ||
		!hasExpiredGenerationWorkerLease(jobRecord.responseMetadata)
	) {
		throw new Error('Only worker runs with expired leases can be canceled from operations.')
	}

	const persistedResponseMetadata =
		jobRecord.responseMetadata && typeof jobRecord.responseMetadata === 'object'
			? (jobRecord.responseMetadata as Record<string, unknown>)
			: {}
	const refundReferenceId =
		getGenerationBillingMetadata(jobRecord.responseMetadata).refundReferenceId ??
		`generation:${jobRecord.id}:refund`
	const refundedCredits =
		getGenerationBillingMetadata(jobRecord.responseMetadata).chargedCredits ?? 0
	const cancelledAt = new Date()

	return db.transaction(async (tx) => {
		const [claimedCancellation] = await tx
			.update(generationJob)
			.set({
				completedAt: cancelledAt,
				errorMessage: 'Generation was canceled after the deferred worker lease expired.',
				status: 'cancelled',
				updatedAt: cancelledAt,
			})
			.where(and(eq(generationJob.id, jobRecord.id), buildExpiredWorkerLeaseCondition()))
			.returning({ id: generationJob.id })

		if (!claimedCancellation) {
			const [currentJob] = await tx
				.select({ status: generationJob.status })
				.from(generationJob)
				.where(eq(generationJob.id, jobRecord.id))
				.limit(1)

			if (currentJob?.status === 'cancelled') {
				return {
					jobId: jobRecord.id,
					projectSlug: jobRecord.projectSlug,
					reason: 'already_cancelled' as const,
					status: 'cancelled' as const,
				}
			}

			throw new Error('Only worker runs with expired leases can be canceled from operations.')
		}

		const [existingRefund] = await tx
			.select({ id: creditLedger.id })
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.referenceId, refundReferenceId),
					eq(creditLedger.userId, jobRecord.ownerUserId)
				)
			)
			.limit(1)

		let creditedAmount = 0
		let balanceAfterRefund: number | null = null

		if (!existingRefund && refundedCredits > 0) {
			const creditBalance = await getCreditBalance(tx, jobRecord.ownerUserId)
			creditedAmount = refundedCredits
			balanceAfterRefund = creditBalance + refundedCredits

			await tx.insert(creditLedger).values({
				amount: refundedCredits,
				balanceAfter: balanceAfterRefund,
				description: buildGenerationRefundDescription(jobRecord.title),
				entryType: 'refund',
				referenceId: refundReferenceId,
				userId: jobRecord.ownerUserId,
			})
		}

		await tx
			.update(generationJob)
			.set({
				responseMetadata: buildCancellationResponseMetadata({
					balanceAfterRefund,
					cancelledAt,
					cancellationReason: 'expired_worker_lease',
					persistedResponseMetadata,
					refundReferenceId,
					refundedCredits: creditedAmount,
				}),
			})
			.where(eq(generationJob.id, jobRecord.id))

		return {
			jobId: jobRecord.id,
			projectSlug: jobRecord.projectSlug,
			reason: 'expired_worker_lease' as const,
			status: 'cancelled' as const,
		}
	})
}

export async function retryProjectGeneration(options: {
	jobId: string
	projectSlug: string
	userId: string
}) {
	const [jobRecord] = await db
		.select({
			aspectRatio: generationJob.aspectRatio,
			id: generationJob.id,
			presetId: generationJob.presetId,
			projectSlug: project.slug,
			requestMetadata: generationJob.requestMetadata,
			sourceAssetId: generationJob.sourceAssetId,
			status: generationJob.status,
		})
		.from(generationJob)
		.innerJoin(project, eq(project.id, generationJob.projectId))
		.where(
			and(
				eq(generationJob.id, options.jobId),
				eq(project.ownerUserId, options.userId),
				eq(project.slug, options.projectSlug)
			)
		)
		.limit(1)

	if (!jobRecord) {
		throw new Error('Generation job not found')
	}

	if (jobRecord.status !== 'failed') {
		throw new Error('Only failed jobs can be retried')
	}

	if (!jobRecord.presetId) {
		throw new Error('This generation cannot be retried because its preset is unavailable')
	}

	return executeProjectGeneration({
		additionalInstructions: getStoredAdditionalInstructions(jobRecord.requestMetadata),
		aspectRatio: jobRecord.aspectRatio,
		presetId: jobRecord.presetId,
		projectSlug: jobRecord.projectSlug,
		retryOfJobId: jobRecord.id,
		sourceAssetId: jobRecord.sourceAssetId,
		trigger: 'retry',
		userId: options.userId,
	})
}
