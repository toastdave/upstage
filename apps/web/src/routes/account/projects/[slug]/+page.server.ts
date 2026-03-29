import { formatProjectType } from '$lib/projects'
import { db } from '$lib/server/db'
import { normalizeOptionalText } from '$lib/server/projects'
import {
	buildSourceAssetStorageKey,
	buildSourceAssetUrl,
	uploadSourceAssetObject,
} from '$lib/server/storage'
import {
	parseImageDimension,
	sourceUploadConstraints,
	validateSourceUpload,
} from '$lib/server/uploads'
import { error, fail, redirect } from '@sveltejs/kit'
import { project, sourceAsset } from '@upstage/db/schema'
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
		url: buildSourceAssetUrl(storageKey),
		originalFilename: normalizeOptionalText(options.file.name, 180),
		mimeType: options.file.type,
		fileSizeBytes: options.file.size,
		width: options.width,
		height: options.height,
	})
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}`)
	}

	const projectRecord = await getOwnedProject(params.slug, locals.user.id)

	const assets = await db
		.select()
		.from(sourceAsset)
		.where(eq(sourceAsset.projectId, projectRecord.id))
		.orderBy(desc(sourceAsset.createdAt))

	return {
		activeAssets: assets.filter((item) => item.archivedAt === null),
		archivedAssets: assets.filter((item) => item.archivedAt !== null),
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
			message: 'Source photo uploaded. You can add more rooms or move into generation next.',
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
			message: 'Source photo replaced. The previous version moved into the archived list.',
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
}
