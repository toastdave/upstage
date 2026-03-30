import { getAiRuntimeConfig } from '../config'
import type { GenerationExecutionInput, GenerationExecutionResult } from '../types'

export async function executeOllamaGeneration(
	input: GenerationExecutionInput
): Promise<GenerationExecutionResult> {
	const config = getAiRuntimeConfig()

	if (!config.localImageRouteEnabled) {
		throw new Error(
			'Local Ollama image generation is disabled. Set AI_LOCAL_IMAGE_ROUTE_ENABLED=true to enable it.'
		)
	}

	const response = await fetch(`${config.localBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: config.localImageModel,
			messages: [
				{
					role: 'user',
					content: input.compiledPrompt,
					images: [Buffer.from(input.sourceImage.data).toString('base64')],
				},
			],
			stream: false,
			options: {
				num_predict: 1024,
			},
		}),
	})

	if (!response.ok) {
		throw new Error(`Ollama request failed with status ${response.status}`)
	}

	const payload = (await response.json()) as {
		created_at?: string
		done_reason?: string
		eval_count?: number
		eval_duration?: number
		load_duration?: number
		message?: {
			content?: string
			images?: string[]
		}
		total_duration?: number
	}

	const images = (payload.message?.images ?? []).map((base64, index) => ({
		data: Uint8Array.from(Buffer.from(base64, 'base64')),
		mimeType: 'image/png',
		sortOrder: index,
	}))

	if (images.length === 0) {
		throw new Error(
			'Ollama did not return any images. Confirm the local model supports image generation on this machine.'
		)
	}

	return {
		providerRoute: 'ollama-local',
		model: config.localImageModel,
		images,
		requestMetadata: {
			baseUrl: config.localBaseUrl,
			jobId: input.jobId,
			model: config.localImageModel,
			route: 'ollama-local',
		},
		responseMetadata: {
			createdAt: payload.created_at ?? null,
			doneReason: payload.done_reason ?? null,
			evalCount: payload.eval_count ?? null,
			evalDuration: payload.eval_duration ?? null,
			loadDuration: payload.load_duration ?? null,
			messageContent: payload.message?.content ?? null,
			totalDuration: payload.total_duration ?? null,
		},
		warnings: [
			'Local Flux generation quality and feature support may vary by hardware and host platform.',
		],
	}
}
