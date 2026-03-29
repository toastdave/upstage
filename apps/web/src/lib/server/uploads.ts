const megabyte = 1024 * 1024

export const sourceUploadConstraints = {
	allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	maxFileSizeBytes: 25 * megabyte,
}

export function parseImageDimension(value: FormDataEntryValue | null) {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return null
	}

	const parsed = Number.parseInt(value, 10)

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null
	}

	return parsed
}

export function validateSourceUpload(file: File | null) {
	if (!file || file.size === 0) {
		return { error: 'Choose a JPG, PNG, or WebP room photo to continue.' }
	}

	if (!sourceUploadConstraints.allowedMimeTypes.includes(file.type)) {
		return { error: 'Only JPG, PNG, and WebP images are supported right now.' }
	}

	if (file.size > sourceUploadConstraints.maxFileSizeBytes) {
		return { error: 'Images must be 25 MB or smaller.' }
	}

	return { error: null }
}
