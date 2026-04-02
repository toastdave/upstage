import { createHash } from 'node:crypto'

export const recentGenerationDuplicateWindowMinutes = 15

export type GenerationJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

export type GenerationSubmissionMetadata = {
	additionalInstructions: string | null
	retryAttempt: number | null
	retryOfJobId: string | null
	sourceAssetId: string | null
	submissionKey: string | null
	submittedAt: string | null
	trigger: 'manual' | 'retry' | null
}

export type GenerationExecutionMetadata = {
	acceptedAt: string | null
	cancelledAt: string | null
	cancellationReason: string | null
	completedAt: string | null
	imageCount: number | null
	processingMode: string | null
	queueDurationMs: number | null
	retryAttempt: number | null
	retryOfJobId: string | null
	runDurationMs: number | null
	startedAt: string | null
	totalDurationMs: number | null
	trigger: 'manual' | 'retry' | null
}

export type GenerationBillingMetadata = {
	balanceAfterCharge: number | null
	balanceAfterRefund: number | null
	chargeReferenceId: string | null
	chargedCredits: number | null
	refundReferenceId: string | null
	refundedCredits: number | null
}

export type StoredGenerationFailureDetails = GenerationFailureDetails & {
	failedAt: string | null
}

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

function asRecord(value: unknown) {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readString(value: unknown) {
	return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown) {
	return typeof value === 'boolean' ? value : null
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

export function canCancelGenerationJob(status: GenerationJobStatus) {
	return status === 'queued'
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

export function getGenerationSubmissionMetadata(
	requestMetadata: unknown
): GenerationSubmissionMetadata {
	const request = asRecord(requestMetadata)
	const submission = asRecord(request?.submission)

	return {
		additionalInstructions: normalizeAdditionalInstructions(
			readString(submission?.additionalInstructions)
		),
		retryAttempt: readNumber(submission?.retryAttempt),
		retryOfJobId: readString(submission?.retryOfJobId),
		sourceAssetId: readString(submission?.sourceAssetId),
		submissionKey: readString(submission?.submissionKey),
		submittedAt: readString(submission?.submittedAt),
		trigger:
			submission?.trigger === 'manual' || submission?.trigger === 'retry'
				? submission.trigger
				: null,
	}
}

export function getGenerationExecutionMetadata(
	responseMetadata: unknown
): GenerationExecutionMetadata {
	const response = asRecord(responseMetadata)
	const execution = asRecord(response?.execution)

	return {
		acceptedAt: readString(execution?.acceptedAt),
		cancelledAt: readString(execution?.cancelledAt),
		cancellationReason: readString(execution?.cancellationReason),
		completedAt: readString(execution?.completedAt),
		imageCount: readNumber(execution?.imageCount),
		processingMode: readString(execution?.processingMode),
		queueDurationMs: readNumber(execution?.queueDurationMs),
		retryAttempt: readNumber(execution?.retryAttempt),
		retryOfJobId: readString(execution?.retryOfJobId),
		runDurationMs: readNumber(execution?.runDurationMs),
		startedAt: readString(execution?.startedAt),
		totalDurationMs: readNumber(execution?.totalDurationMs),
		trigger:
			execution?.trigger === 'manual' || execution?.trigger === 'retry' ? execution.trigger : null,
	}
}

export function getGenerationBillingMetadata(responseMetadata: unknown): GenerationBillingMetadata {
	const response = asRecord(responseMetadata)
	const billing = asRecord(response?.billing)

	return {
		balanceAfterCharge: readNumber(billing?.balanceAfterCharge),
		balanceAfterRefund: readNumber(billing?.balanceAfterRefund),
		chargeReferenceId: readString(billing?.chargeReferenceId),
		chargedCredits: readNumber(billing?.chargedCredits),
		refundReferenceId: readString(billing?.refundReferenceId),
		refundedCredits: readNumber(billing?.refundedCredits),
	}
}

export function getGenerationFailureMetadata(
	responseMetadata: unknown
): StoredGenerationFailureDetails | null {
	const response = asRecord(responseMetadata)
	const failure = asRecord(response?.failure)
	const category = failure?.category
	const message = readString(failure?.message)
	const retryable = readBoolean(failure?.retryable)

	if (
		(category !== 'configuration' &&
			category !== 'provider' &&
			category !== 'resource' &&
			category !== 'validation' &&
			category !== 'unknown') ||
		!message ||
		retryable === null
	) {
		return null
	}

	return {
		category,
		failedAt: readString(failure?.failedAt),
		message,
		name: readString(failure?.name),
		retryable,
	}
}

export function getStoredAdditionalInstructions(requestMetadata: unknown) {
	return getGenerationSubmissionMetadata(requestMetadata).additionalInstructions
}
