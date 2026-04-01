import { formatProjectType } from '$lib/projects'

export const roomBriefStatusValues = ['missing', 'draft', 'reviewed'] as const

export type RoomBriefStatus = (typeof roomBriefStatusValues)[number]

export type RoomBrief = {
	roomType: string
	propertyType: string
	styleDirection: string
	lightingConditions: string
	architecturalAnchors: string
	existingFurniture: string
	protectedElements: string
	requestedChanges: string
	realismGuidance: string
	notes: string
}

export const roomBriefFieldDefinitions = [
	{
		key: 'roomType',
		label: 'Room type',
		placeholder: 'Living room, bedroom, kitchen...',
		rows: 1,
	},
	{
		key: 'propertyType',
		label: 'Property type',
		placeholder: 'Condo, house, vacation rental...',
		rows: 1,
	},
	{
		key: 'styleDirection',
		label: 'Style direction',
		placeholder: 'Warm minimal, coastal, modern organic...',
		rows: 2,
	},
	{
		key: 'lightingConditions',
		label: 'Lighting conditions',
		placeholder: 'Describe the lighting to preserve...',
		rows: 2,
	},
	{
		key: 'architecturalAnchors',
		label: 'Architectural anchors',
		placeholder: 'Windows, doors, built-ins, trim, fireplace...',
		rows: 3,
	},
	{
		key: 'existingFurniture',
		label: 'Existing furniture',
		placeholder: 'What furnishings should stay, go, or be ignored...',
		rows: 3,
	},
	{
		key: 'protectedElements',
		label: 'Protected elements',
		placeholder: 'Windows, layout, permanent architecture...',
		rows: 3,
	},
	{
		key: 'requestedChanges',
		label: 'Requested changes',
		placeholder: 'What should the transformation accomplish...',
		rows: 3,
	},
	{
		key: 'realismGuidance',
		label: 'Realism guidance',
		placeholder: 'Keep this believable and listing-friendly...',
		rows: 3,
	},
	{
		key: 'notes',
		label: 'Notes',
		placeholder: 'Any additional room context...',
		rows: 3,
	},
] as const satisfies ReadonlyArray<{
	key: keyof RoomBrief
	label: string
	placeholder: string
	rows: number
}>

export type RoomBriefFieldDefinition = (typeof roomBriefFieldDefinitions)[number]

export const emptyRoomBrief: RoomBrief = {
	architecturalAnchors: '',
	existingFurniture: '',
	lightingConditions: '',
	notes: '',
	propertyType: '',
	protectedElements: '',
	realismGuidance: '',
	requestedChanges: '',
	roomType: '',
	styleDirection: '',
}

function normalizeTextValue(value: unknown, fallback = '') {
	if (typeof value !== 'string') {
		return fallback
	}

	return value.trim()
}

function inferRoomTypeFromFilename(filename: string | null) {
	const normalized = filename?.toLowerCase() ?? ''

	if (normalized.includes('bed')) {
		return 'Bedroom'
	}

	if (normalized.includes('kitchen')) {
		return 'Kitchen'
	}

	if (normalized.includes('bath')) {
		return 'Bathroom'
	}

	if (normalized.includes('office')) {
		return 'Home office'
	}

	if (normalized.includes('dining')) {
		return 'Dining room'
	}

	if (normalized.includes('outdoor') || normalized.includes('patio')) {
		return 'Outdoor space'
	}

	return 'Living room'
}

function defaultArchitecturalAnchors(roomType: string) {
	if (roomType.toLowerCase().includes('kitchen')) {
		return 'Cabinet runs, countertops, windows, doors, flooring transitions, and appliance placements.'
	}

	if (roomType.toLowerCase().includes('bath')) {
		return 'Vanity placement, mirror wall, shower or tub zone, tile lines, windows, and plumbing fixtures.'
	}

	if (roomType.toLowerCase().includes('bed')) {
		return 'Window walls, doors, trim, ceiling lines, closets, and any built-in millwork.'
	}

	return 'Windows, doors, trim, built-ins, ceiling lines, fireplaces, and major circulation paths.'
}

function defaultExistingFurniture(projectType: string) {
	if (projectType === 'virtual_staging' || projectType === 'empty_room_design') {
		return 'Treat the room as empty or lightly furnished. Preserve only permanent built-ins and architectural fixtures.'
	}

	return 'Preserve the overall layout and any large furnishings unless the redesign brief explicitly changes them.'
}

function defaultProtectedElements(roomType: string) {
	if (roomType.toLowerCase().includes('kitchen')) {
		return 'Cabinet layout, countertops, sink wall, windows, doors, flooring, and permanent lighting locations.'
	}

	if (roomType.toLowerCase().includes('bath')) {
		return 'Vanity placement, plumbing fixtures, tile layout, windows, doors, mirrors, and permanent lighting.'
	}

	return 'Windows, doors, wall trim, flooring, permanent built-ins, ceiling lines, and the overall room layout.'
}

function defaultRequestedChanges(projectType: string, styleIntent: string) {
	const workflow = formatProjectType(projectType).toLowerCase()
	const styleClause = styleIntent
		? `Keep the transformation aligned with ${styleIntent.toLowerCase()} styling.`
		: 'Choose a believable, market-ready design direction.'

	return `Create a ${workflow} concept for the uploaded space. ${styleClause}`
}

export function normalizeRoomBrief(input: unknown, fallback: Partial<RoomBrief> = {}): RoomBrief {
	const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

	return {
		architecturalAnchors: normalizeTextValue(
			source.architecturalAnchors,
			fallback.architecturalAnchors
		),
		existingFurniture: normalizeTextValue(source.existingFurniture, fallback.existingFurniture),
		lightingConditions: normalizeTextValue(source.lightingConditions, fallback.lightingConditions),
		notes: normalizeTextValue(source.notes, fallback.notes),
		propertyType: normalizeTextValue(source.propertyType, fallback.propertyType),
		protectedElements: normalizeTextValue(source.protectedElements, fallback.protectedElements),
		realismGuidance: normalizeTextValue(source.realismGuidance, fallback.realismGuidance),
		requestedChanges: normalizeTextValue(source.requestedChanges, fallback.requestedChanges),
		roomType: normalizeTextValue(source.roomType, fallback.roomType),
		styleDirection: normalizeTextValue(source.styleDirection, fallback.styleDirection),
	}
}

export function buildFallbackRoomBrief(input: {
	project: {
		locationLabel: string | null
		notes: string | null
		projectType: string
		propertyType: string | null
		roomType: string | null
		styleIntent: string | null
		title: string
	}
	sourceAsset: {
		originalFilename: string | null
	}
}) {
	const roomType =
		input.project.roomType ?? inferRoomTypeFromFilename(input.sourceAsset.originalFilename)
	const propertyType = input.project.propertyType ?? 'Residential interior'
	const styleDirection = input.project.styleIntent ?? 'Market-ready modern styling'
	const locationClause = input.project.locationLabel
		? `Keep the result believable for ${input.project.locationLabel}.`
		: 'Keep the result believable for a real-world listing photo.'

	return {
		architecturalAnchors: defaultArchitecturalAnchors(roomType),
		existingFurniture: defaultExistingFurniture(input.project.projectType),
		lightingConditions: `${locationClause} Preserve natural light direction, window influence, and realistic shadows.`,
		notes: input.project.notes ?? '',
		propertyType,
		protectedElements: defaultProtectedElements(roomType),
		realismGuidance:
			'Keep perspective, scale, and materials photorealistic. Avoid impossible furniture placement, blocked walkways, and overly stylized finishes.',
		requestedChanges: defaultRequestedChanges(input.project.projectType, styleDirection),
		roomType,
		styleDirection,
	}
}

export function buildRoomBriefSummary(roomBrief: RoomBrief) {
	const segments = [
		roomBrief.roomType,
		roomBrief.styleDirection,
		roomBrief.requestedChanges,
	].filter((value) => value.length > 0)

	if (segments.length === 0) {
		return 'Draft room brief prepared from the project context.'
	}

	return segments.join(' · ').slice(0, 220)
}

export function getRoomBriefFieldLabel(key: keyof RoomBrief) {
	return roomBriefFieldDefinitions.find((field) => field.key === key)?.label ?? key
}

export function getRoomBriefFieldState(field: keyof RoomBrief, status: RoomBriefStatus) {
	if (field === 'protectedElements') {
		return 'Locked'
	}

	return status === 'reviewed' ? 'Confirmed' : 'Inferred'
}
