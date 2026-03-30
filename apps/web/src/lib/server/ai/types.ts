export type GenerationProviderRoute = 'ollama-local' | 'gateway-gemini'

export type GenerationCapability = {
	label: string
	route: GenerationProviderRoute
	description: string
	supportsStructuredRoomBrief: boolean
	supportsSourceImageEditing: boolean
	supportsMultipleReferenceImages: boolean
	supportsExplicitAspectRatio: boolean
	notes?: string
	preferredAspectRatios: string[]
}

export type GeneratedImageArtifact = {
	data: Uint8Array
	mimeType: string
	revisedPrompt?: string | null
	seed?: number | null
	width?: number | null
	height?: number | null
	sortOrder: number
}

export type GenerationExecutionInput = {
	additionalInstructions: string | null
	aspectRatio: string
	compiledPrompt: string
	jobId: string
	presetName: string
	projectSlug: string
	protectedElements: string | null
	requestedCount: number
	sourceImage: {
		data: Uint8Array
		mimeType: string
		storageKey: string
	}
	styleIntent: string | null
	userId: string
	workflowLabel: string
	workflowType: string
	roomBrief: Record<string, unknown>
}

export type GenerationExecutionResult = {
	providerGenerationId?: string | null
	providerRoute: GenerationProviderRoute
	model: string
	images: GeneratedImageArtifact[]
	requestMetadata: Record<string, unknown>
	responseMetadata: Record<string, unknown>
	warnings?: string[]
}
