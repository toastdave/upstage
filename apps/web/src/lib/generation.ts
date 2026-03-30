export const aspectRatioOptions = [
	{ label: 'Square', value: '1:1' },
	{ label: 'Listing landscape', value: '4:3' },
	{ label: 'Wide landscape', value: '16:9' },
	{ label: 'Editorial portrait', value: '3:4' },
	{ label: 'Story portrait', value: '9:16' },
] as const

export function formatAspectRatio(aspectRatio: string) {
	return aspectRatioOptions.find((option) => option.value === aspectRatio)?.label ?? aspectRatio
}

export function estimateGenerationCredits(aspectRatio: string) {
	switch (aspectRatio) {
		case '16:9':
		case '9:16':
			return 8
		case '4:3':
		case '3:4':
			return 7
		default:
			return 6
	}
}
