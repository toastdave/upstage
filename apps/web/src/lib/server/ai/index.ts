import { getGenerationRoute } from './config'
import { executeGatewayGeneration } from './providers/gateway'
import { executeOllamaGeneration } from './providers/ollama'
import type {
	GenerationExecutionInput,
	GenerationExecutionResult,
	GenerationProviderRoute,
} from './types'

export async function executeImageGenerationForRoute(
	route: GenerationProviderRoute,
	input: GenerationExecutionInput
): Promise<GenerationExecutionResult> {
	switch (route) {
		case 'ollama-local':
			return executeOllamaGeneration(input)
		case 'gateway-gemini':
			return executeGatewayGeneration(input)
	}
}

export async function executeImageGeneration(
	input: GenerationExecutionInput
): Promise<GenerationExecutionResult> {
	return executeImageGenerationForRoute(getGenerationRoute(), input)
}
