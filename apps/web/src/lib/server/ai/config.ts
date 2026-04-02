import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import type { GenerationCapability, GenerationProviderRoute } from './types'

export type GenerationProcessingMode = 'inline' | 'deferred'

function coalesce(...values: Array<string | undefined>) {
	return values.find((value) => value && value.trim().length > 0)?.trim()
}

function parseBoolean(value: string | undefined, fallback: boolean) {
	if (!value) {
		return fallback
	}

	return value === 'true'
}

function parseGenerationProcessingMode(value: string | undefined): GenerationProcessingMode {
	return value === 'deferred' ? 'deferred' : 'inline'
}

export function getAiRuntimeConfig() {
	const executionMode = coalesce(env.AI_EXECUTION_MODE, process.env.AI_EXECUTION_MODE)
	const localRouteEnabled = executionMode ? executionMode === 'local' : dev

	return {
		executionMode: localRouteEnabled ? 'local' : 'production',
		generationProcessingMode: parseGenerationProcessingMode(
			coalesce(env.AI_GENERATION_PROCESSING_MODE, process.env.AI_GENERATION_PROCESSING_MODE)
		),
		gatewayApiKey: coalesce(env.AI_GATEWAY_API_KEY, process.env.AI_GATEWAY_API_KEY),
		jobRunnerToken: coalesce(env.AI_JOB_RUNNER_TOKEN, process.env.AI_JOB_RUNNER_TOKEN),
		localAnalysisModel:
			coalesce(env.AI_LOCAL_ANALYSIS_MODEL, process.env.AI_LOCAL_ANALYSIS_MODEL) ?? 'gemma3',
		localBaseUrl:
			coalesce(env.OLLAMA_BASE_URL, process.env.OLLAMA_BASE_URL) ?? 'http://localhost:1207',
		localImageModel:
			coalesce(env.AI_LOCAL_IMAGE_MODEL, process.env.AI_LOCAL_IMAGE_MODEL) ?? 'x/flux2-klein:4b',
		localImageRouteEnabled: parseBoolean(
			coalesce(env.AI_LOCAL_IMAGE_ROUTE_ENABLED, process.env.AI_LOCAL_IMAGE_ROUTE_ENABLED),
			true
		),
		localRouteEnabled,
		primaryGatewayModel:
			coalesce(env.AI_PRIMARY_MODEL, process.env.AI_PRIMARY_MODEL) ??
			'google/gemini-3-pro-image-preview',
		fallbackGatewayModel: coalesce(env.AI_FALLBACK_MODEL, process.env.AI_FALLBACK_MODEL),
	}
}

export function getGenerationProcessingMode() {
	return getAiRuntimeConfig().generationProcessingMode
}

export function getGenerationJobRunnerToken() {
	return getAiRuntimeConfig().jobRunnerToken ?? null
}

export function getGenerationRoute(): GenerationProviderRoute {
	return getAiRuntimeConfig().localRouteEnabled ? 'ollama-local' : 'gateway-gemini'
}

export function getConfiguredGenerationModel(route = getGenerationRoute()) {
	const config = getAiRuntimeConfig()

	return route === 'ollama-local' ? config.localImageModel : config.primaryGatewayModel
}

export function getGenerationCapabilities(): GenerationCapability[] {
	return [
		{
			label: 'Ollama + Flux 2 Klein',
			route: 'ollama-local',
			description:
				'Free local generation path for development and prompt iteration, backed by Ollama.',
			supportsStructuredRoomBrief: true,
			supportsSourceImageEditing: true,
			supportsMultipleReferenceImages: false,
			supportsExplicitAspectRatio: false,
			preferredAspectRatios: ['1:1'],
			notes:
				'Aspect ratio is currently a prompt hint for local Flux runs. Ollama image generation support varies by host platform.',
		},
		{
			label: 'Gemini via AI Gateway',
			route: 'gateway-gemini',
			description:
				'Production-quality hosted route through Vercel AI Gateway for higher-fidelity room edits.',
			supportsStructuredRoomBrief: true,
			supportsSourceImageEditing: true,
			supportsMultipleReferenceImages: false,
			supportsExplicitAspectRatio: true,
			preferredAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
		},
	]
}
