export const projectTypeCards = [
	{
		value: 'virtual_staging',
		label: 'Virtual staging',
		description: 'Stage empty listings with furniture, styling, and market-ready lighting.',
	},
	{
		value: 'empty_room_design',
		label: 'Empty room design',
		description: 'Explore complete interior concepts before buying furniture or pitching a plan.',
	},
	{
		value: 'existing_room_redesign',
		label: 'Existing room redesign',
		description: 'Refresh lived-in rooms while preserving the original layout and architecture.',
	},
] as const

export const propertyTypeOptions = [
	'House',
	'Apartment',
	'Condo',
	'Townhome',
	'Vacation rental',
	'Studio',
	'Commercial',
] as const

export const roomTypeOptions = [
	'Living room',
	'Bedroom',
	'Kitchen',
	'Dining room',
	'Bathroom',
	'Home office',
	'Studio',
	'Outdoor space',
] as const

export type ProjectType = (typeof projectTypeCards)[number]['value']

export function formatProjectType(projectType: string) {
	return projectTypeCards.find((item) => item.value === projectType)?.label ?? projectType
}

export function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
