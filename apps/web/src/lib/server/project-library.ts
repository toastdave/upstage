import { formatProjectType } from '$lib/projects'
import { buildFallbackRoomBrief, buildRoomBriefSummary, normalizeRoomBrief } from '$lib/room-briefs'
import { loadUserBillingSnapshot } from '$lib/server/billing'
import { db } from '$lib/server/db'
import { loadProjectGenerationState } from '$lib/server/generation-jobs'
import { error } from '@sveltejs/kit'
import { generationImage, generationJob, project, sourceAsset } from '@upstage/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export async function getOwnedProject(slug: string, userId: string) {
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

export async function loadProjectWorkspaceData(slug: string, userId: string) {
	const projectRecord = await getOwnedProject(slug, userId)
	const billing = await loadUserBillingSnapshot(userId)
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
	}
}

export async function getProjectGenerationImage(generationImageId: string, projectId: string) {
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

export async function toggleProjectGenerationImageFavorite(options: {
	generationImageId: string
	projectId: string
}) {
	const targetImage = await getProjectGenerationImage(options.generationImageId, options.projectId)

	if (!targetImage) {
		return null
	}

	const nextValue = !targetImage.isFavorite

	await db
		.update(generationImage)
		.set({ isFavorite: nextValue })
		.where(eq(generationImage.id, targetImage.id))

	return {
		generationImageId: targetImage.id,
		isFavorite: nextValue,
	}
}
