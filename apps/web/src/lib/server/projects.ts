import { type ProjectType, projectTypeCards } from '$lib/projects'

export function createProjectSlug(title: string) {
	const base = title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 54)

	const fallback = base || 'project'
	const suffix = crypto.randomUUID().slice(0, 6)

	return `${fallback}-${suffix}`
}

export function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number) {
	if (typeof value !== 'string') {
		return null
	}

	const normalized = value.trim().slice(0, maxLength)

	return normalized.length > 0 ? normalized : null
}

export function parseProjectType(value: FormDataEntryValue | null) {
	if (typeof value !== 'string') {
		return null
	}

	return projectTypeCards.some((option) => option.value === value) ? (value as ProjectType) : null
}
