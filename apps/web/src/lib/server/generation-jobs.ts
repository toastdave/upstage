import {
	getConfiguredGenerationModel,
	getGenerationCapabilities,
	getGenerationRoute,
} from '$lib/server/ai/config'
import { executeImageGeneration } from '$lib/server/ai/index'
import { db } from '$lib/server/db'
import { buildGenerationPlan } from '$lib/server/generation-plan'
import {
	buildGenerationAssetStorageKey,
	buildStoredMediaUrl,
	getStoredObject,
	uploadStoredObject,
} from '$lib/server/storage'
import {
	generationImage,
	generationJob,
	generationPreset,
	project,
	sourceAsset,
} from '@upstage/db/schema'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

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
		})),
		presets,
	}
}

export async function executeProjectGeneration(options: {
	additionalInstructions: string | null
	aspectRatio: string
	presetId: string
	projectSlug: string
	protectedElements: string | null
	sourceAssetId: string
	userId: string
}) {
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

	const generationPlan = buildGenerationPlan({
		additionalInstructions: options.additionalInstructions,
		aspectRatio: options.aspectRatio,
		preset: presetRecord,
		project: projectRecord,
		protectedElements: options.protectedElements,
		sourceAsset: sourceAssetRecord,
	})

	const idempotencyKey = crypto.randomUUID()
	const provider = getGenerationRoute()
	const model = getConfiguredGenerationModel(provider)

	const [createdJob] = await db
		.insert(generationJob)
		.values({
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
			requestMetadata: generationPlan.roomBrief,
			responseMetadata: {},
		})
		.returning({ id: generationJob.id })

	await db
		.update(generationJob)
		.set({ startedAt: new Date(), status: 'processing', updatedAt: new Date() })
		.where(eq(generationJob.id, createdJob.id))

	try {
		const sourceObject = await getStoredObject(sourceAssetRecord.storageKey)

		if (!sourceObject.Body) {
			throw new Error('Source image contents are missing from storage')
		}

		const sourceBuffer = new Uint8Array(await sourceObject.Body.transformToByteArray())
		const executionResult = await executeImageGeneration({
			additionalInstructions: options.additionalInstructions,
			aspectRatio: options.aspectRatio,
			compiledPrompt: generationPlan.compiledPrompt,
			jobId: createdJob.id,
			presetName: presetRecord.name,
			projectSlug: projectRecord.slug,
			protectedElements: options.protectedElements,
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
				createdJob.id,
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
				jobId: createdJob.id,
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

		await db
			.update(generationJob)
			.set({
				provider: executionResult.providerRoute,
				model: executionResult.model,
				providerGenerationId: executionResult.providerGenerationId ?? null,
				requestMetadata: {
					providerRequest: executionResult.requestMetadata,
					roomBrief: generationPlan.roomBrief,
				},
				responseMetadata: executionResult.responseMetadata,
				status: 'succeeded',
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(generationJob.id, createdJob.id))

		return { jobId: createdJob.id }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Generation failed unexpectedly'

		await db
			.update(generationJob)
			.set({
				completedAt: new Date(),
				errorMessage: message,
				status: 'failed',
				updatedAt: new Date(),
			})
			.where(eq(generationJob.id, createdJob.id))

		throw error
	}
}
