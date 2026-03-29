import { db } from '$lib/server/db'
import { createProjectSlug, normalizeOptionalText, parseProjectType } from '$lib/server/projects'
import { fail, redirect } from '@sveltejs/kit'
import { creditLedger, project, sourceAsset } from '@upstage/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, '/auth/sign-in?redirectTo=/account')
	}

	const projects = await db
		.select({
			id: project.id,
			slug: project.slug,
			title: project.title,
			projectType: project.projectType,
			propertyType: project.propertyType,
			roomType: project.roomType,
			status: project.status,
			locationLabel: project.locationLabel,
			updatedAt: project.updatedAt,
			createdAt: project.createdAt,
			activeAssetCount: sql<number>`count(${sourceAsset.id})`,
		})
		.from(project)
		.leftJoin(
			sourceAsset,
			and(eq(sourceAsset.projectId, project.id), isNull(sourceAsset.archivedAt))
		)
		.where(eq(project.ownerUserId, locals.user.id))
		.groupBy(project.id)
		.orderBy(desc(project.updatedAt))

	const [{ creditBalance }] = await db
		.select({
			creditBalance: sql<number>`coalesce(sum(${creditLedger.amount}), 0)`,
		})
		.from(creditLedger)
		.where(eq(creditLedger.userId, locals.user.id))

	const sourcePhotoCount = projects.reduce((total, item) => total + item.activeAssetCount, 0)

	return {
		creditBalance,
		projectCount: projects.length,
		projects,
		session: locals.session,
		sourcePhotoCount,
		user: locals.user,
	}
}

export const actions: Actions = {
	createProject: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(303, '/auth/sign-in?redirectTo=/account')
		}

		const formData = await request.formData()
		const titleEntry = formData.get('title')
		const title = typeof titleEntry === 'string' ? titleEntry.trim() : ''
		const projectType = parseProjectType(formData.get('projectType'))

		const values = {
			locationLabel: normalizeOptionalText(formData.get('locationLabel'), 160) ?? '',
			notes: normalizeOptionalText(formData.get('notes'), 1000) ?? '',
			propertyType: normalizeOptionalText(formData.get('propertyType'), 80) ?? '',
			projectType: projectType ?? 'virtual_staging',
			roomType: normalizeOptionalText(formData.get('roomType'), 80) ?? '',
			styleIntent: normalizeOptionalText(formData.get('styleIntent'), 120) ?? '',
			title,
		}

		if (title.length < 3) {
			return fail(400, {
				error: 'Give the project a descriptive title so it is easy to find later.',
				form: 'createProject',
				values,
			})
		}

		if (!projectType) {
			return fail(400, {
				error: 'Choose a workflow so Upstage knows how to frame the room transformation.',
				form: 'createProject',
				values,
			})
		}

		const slug = createProjectSlug(title)

		await db.insert(project).values({
			ownerUserId: locals.user.id,
			slug,
			title,
			projectType,
			propertyType: values.propertyType || null,
			roomType: values.roomType || null,
			styleIntent: values.styleIntent || null,
			locationLabel: values.locationLabel || null,
			notes: values.notes || null,
		})

		throw redirect(303, `/account/projects/${slug}`)
	},
}
