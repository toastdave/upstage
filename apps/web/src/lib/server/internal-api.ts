import { env } from '$env/dynamic/private'
import { getGenerationJobRunnerToken } from '$lib/server/ai/config'

function coalesce(...values: Array<string | undefined>) {
	return values.find((value) => value && value.trim().length > 0)?.trim() ?? null
}

export function getInternalApiToken() {
	return (
		coalesce(env.UPSTAGE_INTERNAL_API_TOKEN, process.env.UPSTAGE_INTERNAL_API_TOKEN) ??
		getGenerationJobRunnerToken()
	)
}

export function validateInternalApiAuthorization(request: Request) {
	const token = getInternalApiToken()

	if (!token) {
		return {
			error: 'UPSTAGE_INTERNAL_API_TOKEN or AI_JOB_RUNNER_TOKEN must be configured.',
			status: 503,
		} as const
	}

	if (request.headers.get('authorization') !== `Bearer ${token}`) {
		return {
			error: 'Unauthorized.',
			status: 401,
		} as const
	}

	return null
}
