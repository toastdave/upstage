import { aspectRatioOptions } from '$lib/generation'
import { formatProjectType } from '$lib/projects'
import { buildFallbackRoomBrief, buildRoomBriefSummary, normalizeRoomBrief } from '$lib/room-briefs'
import { loadUserBillingSnapshot } from '$lib/server/billing'
import { db } from '$lib/server/db'
import {
	cancelProjectGeneration,
	executeProjectGeneration,
	loadProjectGenerationState,
	retryProjectGeneration,
} from '$lib/server/generation-jobs'
import { normalizeOptionalText } from '$lib/server/projects'
import { buildDraftRoomBrief } from '$lib/server/room-analysis'
import {
	buildSourceAssetStorageKey,
	buildStoredMediaUrl,
	getStoredObject,
	uploadSourceAssetObject,
} from '$lib/server/storage'
import {
	parseImageDimension,
	sourceUploadConstraints,
	validateSourceUpload,
} from '$lib/server/uploads'
import { error, fail, redirect } from '@sveltejs/kit'
import { generationImage, generationJob, project, sourceAsset } from '@upstage/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Actions, PageServerLoad } from './$types'

async function getOwnedProject(slug: string, userId: string) {
	const [record] = await db
		.select()
		.from(project)
		.where(and(eq(project.slug, slug), eq(project.ownerUserId, userId)))
		.limit(1)

	if (!record) {
		throw error(404, 'Project not found')
	}

	return record
}

async function getReplaceableAsset(sourceAssetId: string, projectId: string, userId: string) {
	const [record] = await db
		.select()
		.from(sourceAsset)
		.where(
			and(
				eq(sourceAsset.id, sourceAssetId),
				eq(sourceAsset.projectId, projectId),
				eq(sourceAsset.ownerUserId, userId),
				isNull(sourceAsset.archivedAt)
			)
		)
		.limit(1)

	return record ?? null
}

async function getProjectGenerationImage(generationImageId: string, projectId: string) {
	const [record] = await db
		.select({
			id: generationImage.id,
			isFavorite: generationImage.isFavorite,
		})
		.from(generationImage)
		.innerJoin(generationJob, eq(generationJob.id, generationImage.jobId))
		.where(and(eq(generationImage.id, generationImageId), eq(generationJob.projectId, projectId)))
		.limit(1)

	return record ?? null
}

async function saveSourceAsset(options: {
	file: File
	projectRecord: typeof project.$inferSelect
	replaceAssetId?: string
	userId: string
	width: number | null
	height: number | null
}) {
	const storageKey = buildSourceAssetStorageKey(options.projectRecord.slug, options.file.name)
	const body = new Uint8Array(await options.file.arrayBuffer())
	const draftRoomBrief = await buildDraftRoomBrief({
		project: options.projectRecord,
		sourceAsset: {
			height: options.height,
			mimeType: options.file.type,
			originalFilename: options.file.name,
			width: options.width,
		},
		sourceImage: body,
	})

	await uploadSourceAssetObject({
		body,
		contentType: options.file.type,
		storageKey,
		cacheControl: 'private, max-age=3600',
	})

	if (options.replaceAssetId) {
		await db
			.update(sourceAsset)
			.set({ archivedAt: new Date() })
			.where(
				and(
					eq(sourceAsset.id, options.replaceAssetId),
					eq(sourceAsset.projectId, options.projectRecord.id),
					eq(sourceAsset.ownerUserId, options.userId),
					isNull(sourceAsset.archivedAt)
				)
			)
	}

	await db.insert(sourceAsset).values({
		ownerUserId: options.userId,
		projectId: options.projectRecord.id,
		storageKey,
		url: buildStoredMediaUrl(storageKey),
		originalFilename: normalizeOptionalText(options.file.name, 180),
		mimeType: options.file.type,
		fileSizeBytes: options.file.size,
		width: options.width,
		height: options.height,
		roomBrief: draftRoomBrief.brief,
		roomBriefStatus: 'draft',
		roomBriefSummary: draftRoomBrief.summary,
		roomBriefGeneratedAt: new Date(),
	})
}

function decorateAssetWithRoomBrief(
	projectRecord: typeof project.$inferSelect,
	asset: typeof sourceAsset.$inferSelect
) {
	const fallbackRoomBrief = buildFallbackRoomBrief({
		project: projectRecord,
		sourceAsset: {
			originalFilename: asset.originalFilename,
		},
	})
	const roomBrief = normalizeRoomBrief(asset.roomBrief, fallbackRoomBrief)

	return {
		...asset,
		roomBrief,
		roomBriefSummary: asset.roomBriefSummary ?? buildRoomBriefSummary(roomBrief),
	}
}

function buildGenerationResultMessage(
	result: Awaited<ReturnType<typeof executeProjectGeneration>>
) {
	if (result.outcome === 'duplicate') {
		if (result.status === 'queued' || result.status === 'processing') {
			return 'That same concept run is already in progress. Follow the existing job in the history below.'
		}

		if (result.status === 'succeeded') {
			return 'That same concept already finished recently. Review the saved output batch below instead of creating a duplicate run.'
		}
	}

	if (result.status === 'queued') {
		return 'Generation queued. It will start when the generation worker claims the job. Follow the timeline below for status updates.'
	}

	if (result.status === 'cancelled') {
		return 'This concept run was canceled before provider execution began. Credits were restored automatically.'
	}

	if (result.trigger === 'retry') {
		return `Retry attempt ${result.retryAttempt} finished. Review the newest output batch in the history below.`
	}

	return 'Generation finished. Review the newest output batch in the history section below.'
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
	}

	const projectRecord = await getOwnedProject(params.slug, locals.user.id)
	const billing = await loadUserBillingSnapshot(locals.user.id)
	const assets = await db
		.select()
		.from(sourceAsset)
		.where(eq(sourceAsset.projectId, projectRecord.id))
		.orderBy(desc(sourceAsset.createdAt))
	const generationState = await loadProjectGenerationState(projectRecord.id)
	const decoratedAssets = assets.map((asset) => decorateAssetWithRoomBrief(projectRecord, asset))

	return {
		activeAssets: decoratedAssets.filter((item) => item.archivedAt === null),
		archivedAssets: decoratedAssets.filter((item) => item.archivedAt !== null),
		billing,
		generationState,
		project: {
			...projectRecord,
			projectTypeLabel: formatProjectType(projectRecord.projectType),
		},
		session: locals.session,
		sourceUploadConstraints,
		user: locals.user,
	}
}

export const actions: Actions = {
	uploadAsset: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const fileEntry = formData.get('file')
		const file = fileEntry instanceof File ? fileEntry : null
		const validation = validateSourceUpload(file)

		if (validation.error || !file) {
			return fail(400, { error: validation.error, form: 'uploadAsset' })
		}

		await saveSourceAsset({
			file,
			projectRecord,
			userId: locals.user.id,
			width: parseImageDimension(formData.get('width')),
			height: parseImageDimension(formData.get('height')),
		})

		return {
			form: 'uploadAsset',
			message: 'Source photo uploaded and a draft room brief is ready for review.',
		}
	},

	replaceAsset: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const sourceAssetEntry = formData.get('sourceAssetId')
		const replaceAssetId = typeof sourceAssetEntry === 'string' ? sourceAssetEntry : ''
		const targetAsset = await getReplaceableAsset(replaceAssetId, projectRecord.id, locals.user.id)
		const fileEntry = formData.get('file')
		const file = fileEntry instanceof File ? fileEntry : null
		const validation = validateSourceUpload(file)

		if (!targetAsset) {
			return fail(404, {
				error: 'We could not find that source photo to replace.',
				form: 'replaceAsset',
			})
		}

		if (validation.error || !file) {
			return fail(400, {
				error: validation.error,
				form: 'replaceAsset',
				sourceAssetId: targetAsset.id,
			})
		}

		await saveSourceAsset({
			file,
			projectRecord,
			replaceAssetId: targetAsset.id,
			userId: locals.user.id,
			width: parseImageDimension(formData.get('width')),
			height: parseImageDimension(formData.get('height')),
		})

		return {
			form: 'replaceAsset',
			message: 'Source photo replaced and a fresh draft room brief is ready to review.',
		}
	},

	archiveAsset: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const sourceAssetEntry = formData.get('sourceAssetId')
		const sourceAssetId = typeof sourceAssetEntry === 'string' ? sourceAssetEntry : ''
		const targetAsset = await getReplaceableAsset(sourceAssetId, projectRecord.id, locals.user.id)

		if (!targetAsset) {
			return fail(404, {
				error: 'We could not find that source photo to archive.',
				form: 'archiveAsset',
			})
		}

		await db
			.update(sourceAsset)
			.set({ archivedAt: new Date() })
			.where(
				and(
					eq(sourceAsset.id, targetAsset.id),
					eq(sourceAsset.projectId, projectRecord.id),
					eq(sourceAsset.ownerUserId, locals.user.id),
					isNull(sourceAsset.archivedAt)
				)
			)

		return {
			form: 'archiveAsset',
			message:
				'Source photo archived. You can always upload a fresh room photo for the next round.',
		}
	},

	generateConcept: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const formData = await request.formData()
		const sourceAssetEntry = formData.get('sourceAssetId')
		const presetEntry = formData.get('presetId')
		const aspectRatioEntry = formData.get('aspectRatio')
		const sourceAssetId = typeof sourceAssetEntry === 'string' ? sourceAssetEntry : ''
		const presetId = typeof presetEntry === 'string' ? presetEntry : ''
		const aspectRatio = typeof aspectRatioEntry === 'string' ? aspectRatioEntry : ''
		const additionalInstructions = normalizeOptionalText(
			formData.get('additionalInstructions'),
			1200
		)

		const values = {
			additionalInstructions: additionalInstructions ?? '',
			aspectRatio,
			presetId,
			sourceAssetId,
		}

		if (!sourceAssetId) {
			return fail(400, {
				error: 'Choose a source photo before generating a concept.',
				form: 'generateConcept',
				values,
			})
		}

		if (!presetId) {
			return fail(400, {
				error: 'Choose a preset so the generation plan starts from a tested direction.',
				form: 'generateConcept',
				values,
			})
		}

		if (!aspectRatioOptions.some((option) => option.value === aspectRatio)) {
			return fail(400, {
				error: 'Choose a supported aspect ratio for this concept run.',
				form: 'generateConcept',
				values,
			})
		}

		try {
			const result = await executeProjectGeneration({
				additionalInstructions,
				aspectRatio,
				presetId,
				projectSlug: params.slug,
				sourceAssetId,
				userId: locals.user.id,
			})

			return {
				form: 'generateConcept',
				message: buildGenerationResultMessage(result),
			}
		} catch (error) {
			return fail(400, {
				error:
					error instanceof Error
						? error.message
						: 'Generation failed before completion. Check your local model or provider settings.',
				form: 'generateConcept',
				values,
			})
		}
	},

	saveRoomBrief: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const sourceAssetEntry = formData.get('sourceAssetId')
		const sourceAssetId = typeof sourceAssetEntry === 'string' ? sourceAssetEntry : ''
		const targetAsset = await getReplaceableAsset(sourceAssetId, projectRecord.id, locals.user.id)

		if (!targetAsset) {
			return fail(404, {
				error: 'Choose an active source photo before saving the room brief.',
				form: 'saveRoomBrief',
				values: { sourceAssetId },
			})
		}

		const fallbackRoomBrief = buildFallbackRoomBrief({
			project: projectRecord,
			sourceAsset: {
				originalFilename: targetAsset.originalFilename,
			},
		})
		const roomBrief = normalizeRoomBrief(
			{
				architecturalAnchors:
					normalizeOptionalText(formData.get('architecturalAnchors'), 400) ?? '',
				existingFurniture: normalizeOptionalText(formData.get('existingFurniture'), 400) ?? '',
				lightingConditions: normalizeOptionalText(formData.get('lightingConditions'), 400) ?? '',
				notes: normalizeOptionalText(formData.get('notes'), 600) ?? '',
				propertyType: normalizeOptionalText(formData.get('propertyType'), 80) ?? '',
				protectedElements: normalizeOptionalText(formData.get('protectedElements'), 400) ?? '',
				realismGuidance: normalizeOptionalText(formData.get('realismGuidance'), 400) ?? '',
				requestedChanges: normalizeOptionalText(formData.get('requestedChanges'), 600) ?? '',
				roomType: normalizeOptionalText(formData.get('roomType'), 80) ?? '',
				styleDirection: normalizeOptionalText(formData.get('styleDirection'), 200) ?? '',
			},
			fallbackRoomBrief
		)

		await db
			.update(sourceAsset)
			.set({
				roomBrief,
				roomBriefReviewedAt: new Date(),
				roomBriefStatus: 'reviewed',
				roomBriefSummary: buildRoomBriefSummary(roomBrief),
			})
			.where(
				and(
					eq(sourceAsset.id, targetAsset.id),
					eq(sourceAsset.projectId, projectRecord.id),
					eq(sourceAsset.ownerUserId, locals.user.id),
					isNull(sourceAsset.archivedAt)
				)
			)

		return {
			form: 'saveRoomBrief',
			message: 'Room brief saved. Generation will now use this reviewed version.',
			values: { sourceAssetId },
		}
	},

	reanalyzeRoomBrief: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const sourceAssetEntry = formData.get('sourceAssetId')
		const sourceAssetId = typeof sourceAssetEntry === 'string' ? sourceAssetEntry : ''
		const targetAsset = await getReplaceableAsset(sourceAssetId, projectRecord.id, locals.user.id)

		if (!targetAsset) {
			return fail(404, {
				error: 'Choose an active source photo before re-running room analysis.',
				form: 'reanalyzeRoomBrief',
				values: { sourceAssetId },
			})
		}

		const storedObject = await getStoredObject(targetAsset.storageKey)

		if (!storedObject.Body) {
			return fail(400, {
				error: 'The source photo is missing from storage, so room analysis could not run.',
				form: 'reanalyzeRoomBrief',
				values: { sourceAssetId },
			})
		}

		const sourceImage = new Uint8Array(await storedObject.Body.transformToByteArray())
		const draftRoomBrief = await buildDraftRoomBrief({
			project: projectRecord,
			sourceAsset: {
				height: targetAsset.height,
				mimeType: targetAsset.mimeType,
				originalFilename: targetAsset.originalFilename,
				width: targetAsset.width,
			},
			sourceImage,
		})

		await db
			.update(sourceAsset)
			.set({
				roomBrief: draftRoomBrief.brief,
				roomBriefGeneratedAt: new Date(),
				roomBriefReviewedAt: null,
				roomBriefStatus: 'draft',
				roomBriefSummary: draftRoomBrief.summary,
			})
			.where(
				and(
					eq(sourceAsset.id, targetAsset.id),
					eq(sourceAsset.projectId, projectRecord.id),
					eq(sourceAsset.ownerUserId, locals.user.id),
					isNull(sourceAsset.archivedAt)
				)
			)

		return {
			form: 'reanalyzeRoomBrief',
			message: 'Room analysis reran and refreshed the draft brief for this photo.',
			values: { sourceAssetId },
		}
	},

	retryGeneration: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const generationJobEntry = formData.get('generationJobId')
		const generationJobId = typeof generationJobEntry === 'string' ? generationJobEntry : ''

		if (!generationJobId) {
			return fail(400, {
				error: 'Choose a failed generation before requesting a retry.',
				form: 'retryGeneration',
				values: { generationJobId },
			})
		}

		try {
			const result = await retryProjectGeneration({
				jobId: generationJobId,
				projectSlug: params.slug,
				userId: locals.user.id,
			})

			return {
				form: 'retryGeneration',
				message: buildGenerationResultMessage(result),
				values: { generationJobId },
			}
		} catch (error) {
			return fail(400, {
				error:
					error instanceof Error
						? error.message
						: 'Generation retry failed before completion. Check the job history for more detail.',
				form: 'retryGeneration',
				values: { generationJobId },
			})
		}
	},

	cancelGeneration: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const generationJobEntry = formData.get('generationJobId')
		const generationJobId = typeof generationJobEntry === 'string' ? generationJobEntry : ''

		if (!generationJobId) {
			return fail(400, {
				error: 'Choose a queued generation before requesting cancellation.',
				form: 'cancelGeneration',
				values: { generationJobId },
			})
		}

		try {
			await cancelProjectGeneration({
				jobId: generationJobId,
				projectSlug: params.slug,
				userId: locals.user.id,
			})

			return {
				form: 'cancelGeneration',
				message: 'Queued generation canceled. Credits were restored to your available balance.',
				values: { generationJobId },
			}
		} catch (error) {
			return fail(400, {
				error:
					error instanceof Error
						? error.message
						: 'Generation cancellation failed. Refresh the job history and try again.',
				form: 'cancelGeneration',
				values: { generationJobId },
			})
		}
	},

	toggleFavorite: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const generationImageEntry = formData.get('generationImageId')
		const generationImageId = typeof generationImageEntry === 'string' ? generationImageEntry : ''
		const targetImage = await getProjectGenerationImage(generationImageId, projectRecord.id)

		if (!targetImage) {
			return fail(404, {
				error: 'We could not find that generated image in this project.',
				form: 'toggleFavorite',
				values: { generationImageId },
			})
		}

		const nextValue = !targetImage.isFavorite

		await db
			.update(generationImage)
			.set({ isFavorite: nextValue })
			.where(eq(generationImage.id, targetImage.id))

		return {
			form: 'toggleFavorite',
			message: nextValue
				? 'Marked this render as a favorite deliverable.'
				: 'Removed this render from favorites.',
			values: { generationImageId },
		}
	},
}
