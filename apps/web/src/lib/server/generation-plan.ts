import { estimateGenerationCredits } from '$lib/generation'
import { formatProjectType } from '$lib/projects'
import {
	type RoomBrief,
	type RoomBriefStatus,
	buildFallbackRoomBrief,
	normalizeRoomBrief,
} from '$lib/room-briefs'

type BuildGenerationPlanInput = {
	additionalInstructions: string | null
	aspectRatio: string
	preset: {
		category: string
		name: string
		promptTemplate: string
		slug: string
	}
	project: {
		locationLabel: string | null
		notes: string | null
		projectType: string
		propertyType: string | null
		roomType: string | null
		styleIntent: string | null
		title: string
	}
	roomBrief: unknown
	roomBriefStatus: RoomBriefStatus
	sourceAsset: {
		fileSizeBytes: number
		height: number | null
		mimeType: string
		originalFilename: string | null
		storageKey: string
		width: number | null
	}
}

export function buildGenerationPlan(input: BuildGenerationPlanInput) {
	const workflowLabel = formatProjectType(input.project.projectType)
	const baseRoomBrief = buildFallbackRoomBrief({
		project: input.project,
		sourceAsset: {
			originalFilename: input.sourceAsset.originalFilename,
		},
	})
	const reviewedRoomBrief = normalizeRoomBrief(input.roomBrief, baseRoomBrief)
	const mergedRequestedChanges = [reviewedRoomBrief.requestedChanges, input.additionalInstructions]
		.filter((value) => typeof value === 'string' && value.trim().length > 0)
		.join(' ')
		.trim()
	const roomBrief = {
		analysisStatus: input.roomBriefStatus,
		architecturalAnchors: reviewedRoomBrief.architecturalAnchors,
		existingFurniture: reviewedRoomBrief.existingFurniture,
		intent: workflowLabel,
		lightingConditions: reviewedRoomBrief.lightingConditions,
		locationLabel: input.project.locationLabel,
		notes: input.project.notes,
		preset: input.preset.name,
		presetSlug: input.preset.slug,
		projectTitle: input.project.title,
		propertyType: reviewedRoomBrief.propertyType,
		protectedElements: reviewedRoomBrief.protectedElements,
		realismGuidance: reviewedRoomBrief.realismGuidance,
		requestedChanges: mergedRequestedChanges,
		reviewedRoomBrief,
		roomType: reviewedRoomBrief.roomType,
		sourceAsset: {
			fileSizeBytes: input.sourceAsset.fileSizeBytes,
			height: input.sourceAsset.height,
			mimeType: input.sourceAsset.mimeType,
			originalFilename: input.sourceAsset.originalFilename,
			width: input.sourceAsset.width,
		},
		styleIntent: reviewedRoomBrief.styleDirection,
		targetAspectRatio: input.aspectRatio,
	} satisfies Record<string, unknown>

	const promptSections = [
		`You are producing a ${workflowLabel.toLowerCase()} concept for a real room photo.`,
		input.preset.promptTemplate,
		reviewedRoomBrief.roomType ? `Room type: ${reviewedRoomBrief.roomType}.` : null,
		reviewedRoomBrief.propertyType ? `Property type: ${reviewedRoomBrief.propertyType}.` : null,
		reviewedRoomBrief.styleDirection
			? `Style direction: ${reviewedRoomBrief.styleDirection}.`
			: null,
		input.project.locationLabel ? `Location context: ${input.project.locationLabel}.` : null,
		reviewedRoomBrief.lightingConditions
			? `Lighting conditions to preserve: ${reviewedRoomBrief.lightingConditions}.`
			: null,
		reviewedRoomBrief.architecturalAnchors
			? `Architectural anchors: ${reviewedRoomBrief.architecturalAnchors}.`
			: null,
		reviewedRoomBrief.existingFurniture
			? `Existing furniture context: ${reviewedRoomBrief.existingFurniture}.`
			: null,
		reviewedRoomBrief.protectedElements
			? `Preserve these elements unless the user explicitly changes them: ${reviewedRoomBrief.protectedElements}.`
			: 'Preserve the room layout, windows, doors, permanent architectural lines, and realistic lighting.',
		mergedRequestedChanges ? `Requested transformation details: ${mergedRequestedChanges}.` : null,
		reviewedRoomBrief.realismGuidance
			? `Realism guidance: ${reviewedRoomBrief.realismGuidance}.`
			: null,
		input.project.notes ? `Project notes: ${input.project.notes}.` : null,
		`Target aspect ratio: ${input.aspectRatio}. If the provider lacks explicit ratio controls, treat this as a strong composition hint.`,
		'Keep the result photorealistic, listing-friendly, and grounded in the uploaded space rather than inventing a completely different room.',
		`Structured room brief JSON:\n${JSON.stringify(roomBrief, null, 2)}`,
	].filter(Boolean)

	return {
		compiledPrompt: promptSections.join('\n\n'),
		creditEstimate: estimateGenerationCredits(input.aspectRatio),
		roomBrief,
		workflowLabel,
	}
}
