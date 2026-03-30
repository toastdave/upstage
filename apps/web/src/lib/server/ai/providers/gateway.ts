import { gateway, generateText } from 'ai'
import { getAiRuntimeConfig } from '../config'
import type { GenerationExecutionInput, GenerationExecutionResult } from '../types'

export async function executeGatewayGeneration(
	input: GenerationExecutionInput
): Promise<GenerationExecutionResult> {
	const config = getAiRuntimeConfig()

	const result = await generateText({
		model: gateway(config.primaryGatewayModel),
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: input.compiledPrompt },
					{
						type: 'image',
						image: input.sourceImage.data,
						mediaType: input.sourceImage.mimeType,
					},
				],
			},
		],
		providerOptions: {
			gateway: {
				...(config.fallbackGatewayModel ? { models: [config.fallbackGatewayModel] } : {}),
				tags: ['upstage', 'generation', 'room-transform'],
				user: input.userId,
			},
			google: {
				imageConfig: {
					aspectRatio: input.aspectRatio,
					imageSize: '1K',
				},
				responseModalities: ['IMAGE', 'TEXT'],
			},
		},
	})

	const files = (result.files ?? []).filter((file) => file.mediaType.startsWith('image/'))

	if (files.length === 0) {
		throw new Error('Gemini did not return any images for this generation request.')
	}

	return {
		providerGenerationId:
			typeof result.providerMetadata?.gateway?.generationId === 'string'
				? result.providerMetadata.gateway.generationId
				: null,
		providerRoute: 'gateway-gemini',
		model: config.primaryGatewayModel,
		images: files.map((file, index) => ({
			data: file.uint8Array,
			height: null,
			mimeType: file.mediaType,
			revisedPrompt: result.text || null,
			sortOrder: index,
			width: null,
		})),
		requestMetadata: {
			fallbackModel: config.fallbackGatewayModel ?? null,
			jobId: input.jobId,
			model: config.primaryGatewayModel,
			route: 'gateway-gemini',
		},
		responseMetadata: {
			files: files.map((file) => ({ mediaType: file.mediaType })),
			finishReason: result.finishReason,
			providerMetadata: result.providerMetadata,
			text: result.text,
			usage: result.usage,
		},
	}
}
