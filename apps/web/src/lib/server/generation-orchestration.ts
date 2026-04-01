import { createHash } from 'node:crypto'

export const recentGenerationDuplicateWindowMinutes = 15

type GenerationJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

type SubmissionKeyInput = {
	additionalInstructions: string | null
	aspectRatio: string
	model: string
	presetId: string
	projectId: string
	provider: string
	prompt: string
	sourceAssetId: string
	userId: string
}

type DuplicateCandidate = {
	completedAt: Date | null
	createdAt: Date
	status: GenerationJobStatus
}

export type GenerationFailureDetails = {
	category: 'configuration' | 'provider' | 'resource' | 'validation' | 'unknown'
	message: string
	name: string | null
	retryable: boolean
}

export function buildGenerationSubmissionKey(input: SubmissionKeyInput) {
	const payload = JSON.stringify({
		additionalInstructions: normalizeAdditionalInstructions(input.additionalInstructions),
		aspectRatio: input.aspectRatio,
		model: input.model,
		presetId: input.presetId,
		projectId: input.projectId,
		provider: input.provider,
		prompt: input.prompt,
		sourceAssetId: input.sourceAssetId,
		userId: input.userId,
	})

	return `gen:${createHash('sha256').update(payload).digest('hex')}`
}

export function buildGenerationAttemptKey(submissionKey: string, attemptNumber: number) {
	return attemptNumber <= 1 ? submissionKey : `${submissionKey}:r${attemptNumber}`
}

export function shouldTreatAsDuplicateJob(
	job: DuplicateCandidate,
	now = new Date(),
	windowMinutes = recentGenerationDuplicateWindowMinutes
) {
	if (job.status === 'queued' || job.status === 'processing') {
		return true
	}

	if (job.status !== 'succeeded') {
		return false
	}

	const completedAt = job.completedAt ?? job.createdAt
	const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000)

	return completedAt >= windowStart
}

export function normalizeAdditionalInstructions(value: string | null) {
	const normalized = value?.trim() ?? ''

	return normalized.length > 0 ? normalized : null
}

export function classifyGenerationFailure(error: unknown): GenerationFailureDetails {
	const message = error instanceof Error ? error.message : 'Generation failed unexpectedly'
	const normalizedMessage = message.toLowerCase()

	if (
		normalizedMessage.includes('project not found') ||
		normalizedMessage.includes('source photo not found') ||
		normalizedMessage.includes('preset not found')
	) {
		return {
			category: 'validation',
			message,
			name: error instanceof Error ? error.name : null,
			retryable: false,
		}
	}

	if (
		normalizedMessage.includes('missing from storage') ||
		normalizedMessage.includes('unsupported') ||
		normalizedMessage.includes('invalid')
	) {
		return {
			category: 'resource',
			message,
			name: error instanceof Error ? error.name : null,
			retryable: false,
		}
	}

	if (
		normalizedMessage.includes('api key') ||
		normalizedMessage.includes('disabled') ||
		normalizedMessage.includes('not configured')
	) {
		return {
			category: 'configuration',
			message,
			name: error instanceof Error ? error.name : null,
			retryable: false,
		}
	}

	if (
		normalizedMessage.includes('timeout') ||
		normalizedMessage.includes('rate limit') ||
		normalizedMessage.includes('temporar') ||
		normalizedMessage.includes('network')
	) {
		return {
			category: 'provider',
			message,
			name: error instanceof Error ? error.name : null,
			retryable: true,
		}
	}

	return {
		category: 'unknown',
		message,
		name: error instanceof Error ? error.name : null,
		retryable: true,
	}
}

export function getStoredAdditionalInstructions(requestMetadata: unknown) {
	if (!requestMetadata || typeof requestMetadata !== 'object') {
		return null
	}

	const submission = 'submission' in requestMetadata ? requestMetadata.submission : null

	if (!submission || typeof submission !== 'object') {
		return null
	}

	const additionalInstructions =
		'additionalInstructions' in submission ? submission.additionalInstructions : null

	return typeof additionalInstructions === 'string' && additionalInstructions.trim().length > 0
		? additionalInstructions
		: null
}
