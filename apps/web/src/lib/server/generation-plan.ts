import { estimateGenerationCredits } from '$lib/generation'
import { formatProjectType } from '$lib/projects'

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
	protectedElements: string | null
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
	const roomBrief = {
		intent: workflowLabel,
		locationLabel: input.project.locationLabel,
		notes: input.project.notes,
		preset: input.preset.name,
		presetSlug: input.preset.slug,
		projectTitle: input.project.title,
		propertyType: input.project.propertyType,
		protectedElements: input.protectedElements,
		requestedChanges: input.additionalInstructions,
		roomType: input.project.roomType,
		sourceAsset: {
			fileSizeBytes: input.sourceAsset.fileSizeBytes,
			height: input.sourceAsset.height,
			mimeType: input.sourceAsset.mimeType,
			originalFilename: input.sourceAsset.originalFilename,
			width: input.sourceAsset.width,
		},
		styleIntent: input.project.styleIntent,
		targetAspectRatio: input.aspectRatio,
	} satisfies Record<string, unknown>

	const promptSections = [
		`You are producing a ${workflowLabel.toLowerCase()} concept for a real room photo.`,
		input.preset.promptTemplate,
		input.project.roomType ? `Room type: ${input.project.roomType}.` : null,
		input.project.propertyType ? `Property type: ${input.project.propertyType}.` : null,
		input.project.styleIntent ? `Style direction: ${input.project.styleIntent}.` : null,
		input.project.locationLabel ? `Location context: ${input.project.locationLabel}.` : null,
		input.protectedElements
			? `Preserve these elements unless the user explicitly changes them: ${input.protectedElements}.`
			: 'Preserve the room layout, windows, doors, permanent architectural lines, and realistic lighting.',
		input.additionalInstructions
			? `Requested transformation details: ${input.additionalInstructions}.`
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
