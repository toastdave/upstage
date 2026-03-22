export function normalizeRedirectTo(redirectTo: string | null | undefined, fallback = '/account') {
	if (!redirectTo) {
		return fallback
	}

	if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
		return fallback
	}

	return redirectTo
}
