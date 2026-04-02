import {
	getOwnedProject,
	loadProjectWorkspaceData,
	toggleProjectGenerationImageFavorite,
} from '$lib/server/project-library'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}/gallery`)
	}

	return {
		...(await loadProjectWorkspaceData(params.slug, locals.user.id)),
		session: locals.session,
		user: locals.user,
	}
}

export const actions: Actions = {
	toggleFavorite: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/sign-in?redirectTo=/account/projects/${params.slug}/gallery`)
		}

		const projectRecord = await getOwnedProject(params.slug, locals.user.id)
		const formData = await request.formData()
		const generationImageEntry = formData.get('generationImageId')
		const generationImageId = typeof generationImageEntry === 'string' ? generationImageEntry : ''
		const result = await toggleProjectGenerationImageFavorite({
			generationImageId,
			projectId: projectRecord.id,
		})

		if (!result) {
			return fail(404, {
				error: 'We could not find that generated image in this project.',
				form: 'toggleFavorite',
				values: { generationImageId },
			})
		}

		return {
			form: 'toggleFavorite',
			message: result.isFavorite
				? 'Marked this render as a favorite deliverable.'
				: 'Removed this render from favorites.',
			values: { generationImageId },
		}
	},
}
