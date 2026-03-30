import { getGenerationRoute } from './config'
import { executeGatewayGeneration } from './providers/gateway'
import { executeOllamaGeneration } from './providers/ollama'
import type { GenerationExecutionInput, GenerationExecutionResult } from './types'

export async function executeImageGeneration(
	input: GenerationExecutionInput
): Promise<GenerationExecutionResult> {
	switch (getGenerationRoute()) {
		case 'ollama-local':
			return executeOllamaGeneration(input)
		case 'gateway-gemini':
			return executeGatewayGeneration(input)
	}
}
