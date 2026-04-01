import {
	getConfiguredGenerationModel,
	getGenerationCapabilities,
	getGenerationRoute,
} from '$lib/server/ai/config'
import { executeImageGeneration } from '$lib/server/ai/index'
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
	classifyGenerationFailure,
	getStoredAdditionalInstructions,
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
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

type GenerationTrigger = 'manual' | 'retry'

export type ExecuteProjectGenerationResult = {
	jobId: string
	outcome: 'created' | 'duplicate'
	retryAttempt: number
	status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
	trigger: GenerationTrigger
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
			images: imagesByJobId.get(job.id) ?? [],
			sourceAsset: sourceAssetById.get(job.sourceAssetId) ?? null,
		})),
		presets,
	}
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
	const refundReferenceId = `generation:${createdJobId}:refund`
	const projectTitle = projectRecord.title
	let balanceAfterCharge: number | null = null
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
			balanceAfterCharge = creditBalance - generationPlan.creditEstimate
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

	const persistedRequestMetadata = {
		...baseRequestMetadata,
		submission: {
			...(baseRequestMetadata.submission as Record<string, unknown>),
			retryAttempt,
		},
	} satisfies Record<string, unknown>
	const persistedResponseMetadata = {
		...baseResponseMetadata,
		billing: {
			...(baseResponseMetadata.billing as Record<string, unknown>),
			balanceAfterCharge,
		},
		execution: {
			...(baseResponseMetadata.execution as Record<string, unknown>),
			retryAttempt,
		},
	} satisfies Record<string, unknown>

	const processingStartedAt = new Date()

	await db
		.update(generationJob)
		.set({
			startedAt: processingStartedAt,
			status: 'processing',
			updatedAt: processingStartedAt,
			responseMetadata: {
				...persistedResponseMetadata,
				execution: {
					...(persistedResponseMetadata.execution as Record<string, unknown>),
					startedAt: processingStartedAt.toISOString(),
				},
			},
		})
		.where(eq(generationJob.id, acceptedJobId))

	try {
		const sourceObject = await getStoredObject(sourceAssetRecord.storageKey)

		if (!sourceObject.Body) {
			throw new Error('Source image contents are missing from storage')
		}

		const sourceBuffer = new Uint8Array(await sourceObject.Body.transformToByteArray())
		const executionResult = await executeImageGeneration({
			additionalInstructions: normalizedAdditionalInstructions,
			aspectRatio: options.aspectRatio,
			compiledPrompt: generationPlan.compiledPrompt,
			jobId: acceptedJobId,
			presetName: presetRecord.name,
			projectSlug: projectRecord.slug,
			protectedElements:
				typeof generationPlan.roomBrief.protectedElements === 'string'
					? generationPlan.roomBrief.protectedElements
					: null,
			requestedCount: 1,
			sourceImage: {
				data: sourceBuffer,
				mimeType: sourceAssetRecord.mimeType,
				storageKey: sourceAssetRecord.storageKey,
			},
			styleIntent: projectRecord.styleIntent,
			userId: options.userId,
			workflowLabel: generationPlan.workflowLabel,
			workflowType: projectRecord.projectType,
			roomBrief: generationPlan.roomBrief,
		})

		for (const image of executionResult.images) {
			const storageKey = buildGenerationAssetStorageKey(
				projectRecord.slug,
				acceptedJobId,
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
				jobId: acceptedJobId,
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

		await db
			.update(generationJob)
			.set({
				provider: executionResult.providerRoute,
				model: executionResult.model,
				providerGenerationId: executionResult.providerGenerationId ?? null,
				requestMetadata: {
					...persistedRequestMetadata,
					providerRequest: executionResult.requestMetadata,
				},
				responseMetadata: {
					...executionResult.responseMetadata,
					billing: persistedResponseMetadata.billing,
					execution: {
						...(persistedResponseMetadata.execution as Record<string, unknown>),
						completedAt: completedAt.toISOString(),
						imageCount: executionResult.images.length,
						startedAt: processingStartedAt.toISOString(),
					},
					warnings: executionResult.warnings ?? [],
				},
				status: 'succeeded',
				completedAt,
				updatedAt: completedAt,
			})
			.where(eq(generationJob.id, acceptedJobId))

		return {
			jobId: acceptedJobId,
			outcome: 'created',
			retryAttempt,
			status: 'succeeded',
			trigger,
		}
	} catch (error) {
		const failure = classifyGenerationFailure(error)
		const completedAt = new Date()

		await db.transaction(async (tx) => {
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

			let refundedCredits = 0
			let balanceAfterRefund: number | null = null

			if (!existingRefund) {
				const creditBalance = await getCreditBalance(tx, options.userId)
				refundedCredits = generationPlan.creditEstimate
				balanceAfterRefund = creditBalance + generationPlan.creditEstimate

				await tx.insert(creditLedger).values({
					amount: generationPlan.creditEstimate,
					balanceAfter: balanceAfterRefund,
					description: buildGenerationRefundDescription(projectTitle),
					entryType: 'refund',
					referenceId: refundReferenceId,
					userId: options.userId,
				})
			}

			await tx
				.update(generationJob)
				.set({
					completedAt,
					errorMessage: failure.message,
					responseMetadata: {
						billing: {
							...(persistedResponseMetadata.billing as Record<string, unknown>),
							balanceAfterRefund,
							refundReferenceId,
							refundedCredits,
						},
						execution: {
							...(persistedResponseMetadata.execution as Record<string, unknown>),
							completedAt: completedAt.toISOString(),
							startedAt: processingStartedAt.toISOString(),
						},
						failure: {
							...failure,
							failedAt: completedAt.toISOString(),
						},
					},
					status: 'failed',
					updatedAt: completedAt,
				})
				.where(eq(generationJob.id, acceptedJobId))
		})

		throw error
	}
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
