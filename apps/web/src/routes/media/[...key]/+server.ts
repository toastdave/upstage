import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { getStoredObject } from '$lib/server/storage'
import { error } from '@sveltejs/kit'
import { generationImage, generationJob, project, sourceAsset } from '@upstage/db/schema'
import { and, eq } from 'drizzle-orm'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, request }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	})

	if (!session?.user) {
		throw error(401, 'Sign in to view project assets')
	}

	if (!params.key) {
		throw error(404, 'Asset not found')
	}

	const [sourceMedia] = await db
		.select({
			mimeType: sourceAsset.mimeType,
			originalFilename: sourceAsset.originalFilename,
			storageKey: sourceAsset.storageKey,
		})
		.from(sourceAsset)
		.where(
			and(eq(sourceAsset.storageKey, params.key), eq(sourceAsset.ownerUserId, session.user.id))
		)
		.limit(1)

	const sourceFilename = sourceMedia?.originalFilename ?? 'asset'

	const [generationMedia] = sourceMedia
		? [null]
		: await db
				.select({
					mimeType: generationImage.mimeType,
					originalFilename: project.title,
					storageKey: generationImage.storageKey,
				})
				.from(generationImage)
				.innerJoin(generationJob, eq(generationJob.id, generationImage.jobId))
				.innerJoin(project, eq(project.id, generationJob.projectId))
				.where(
					and(eq(generationImage.storageKey, params.key), eq(project.ownerUserId, session.user.id))
				)
				.limit(1)

	const asset = sourceMedia ?? generationMedia

	if (!asset) {
		throw error(404, 'Asset not found')
	}

	const object = await getStoredObject(asset.storageKey)

	if (!object.Body) {
		throw error(404, 'Asset body not found')
	}

	return new Response(object.Body.transformToWebStream(), {
		headers: {
			'cache-control': 'private, max-age=60',
			'content-disposition': `inline; filename="${sourceMedia ? sourceFilename : `${asset.originalFilename}.png`}"`,
			'content-type': object.ContentType ?? asset.mimeType,
		},
	})
}
