import { describe, expect, test } from 'bun:test'
import {
	buildGenerationAttemptKey,
	buildGenerationSubmissionKey,
	canCancelGenerationJob,
	classifyGenerationFailure,
	getGenerationBillingMetadata,
	getGenerationExecutionMetadata,
	getGenerationFailureMetadata,
	getGenerationSubmissionMetadata,
	hasActiveGenerationWorkerLease,
	hasExpiredGenerationWorkerLease,
	normalizeAdditionalInstructions,
	shouldTreatAsDuplicateJob,
} from './generation-orchestration'

describe('generation orchestration helpers', () => {
	test('buildGenerationSubmissionKey normalizes whitespace-only instructions', () => {
		const baseInput = {
			additionalInstructions: '  keep the windows clear  ',
			aspectRatio: '4:3',
			model: 'google/gemini-3-pro-image-preview',
			presetId: 'preset-1',
			projectId: 'project-1',
			provider: 'gateway-gemini',
			prompt: 'Prompt body',
			sourceAssetId: 'asset-1',
			userId: 'user-1',
		}

		expect(buildGenerationSubmissionKey(baseInput)).toBe(
			buildGenerationSubmissionKey({
				...baseInput,
				additionalInstructions: 'keep the windows clear',
			})
		)
		expect(buildGenerationSubmissionKey(baseInput)).not.toBe(
			buildGenerationSubmissionKey({
				...baseInput,
				aspectRatio: '16:9',
			})
		)
	})

	test('uses the base key for first attempt and suffixes retries', () => {
		expect(buildGenerationAttemptKey('gen:abc', 1)).toBe('gen:abc')
		expect(buildGenerationAttemptKey('gen:abc', 3)).toBe('gen:abc:r3')
	})

	test('treats active jobs and recent successes as duplicates', () => {
		const now = new Date('2026-04-01T12:00:00.000Z')

		expect(
			shouldTreatAsDuplicateJob(
				{
					completedAt: null,
					createdAt: new Date('2026-04-01T11:59:00.000Z'),
					status: 'processing',
				},
				now
			)
		).toBe(true)

		expect(
			shouldTreatAsDuplicateJob(
				{
					completedAt: new Date('2026-04-01T11:50:00.000Z'),
					createdAt: new Date('2026-04-01T11:45:00.000Z'),
					status: 'succeeded',
				},
				now
			)
		).toBe(true)

		expect(
			shouldTreatAsDuplicateJob(
				{
					completedAt: new Date('2026-04-01T11:20:00.000Z'),
					createdAt: new Date('2026-04-01T11:15:00.000Z'),
					status: 'succeeded',
				},
				now
			)
		).toBe(false)
	})

	test('classifies validation and transient failures', () => {
		expect(classifyGenerationFailure(new Error('Source photo not found'))).toMatchObject({
			category: 'validation',
			retryable: false,
		})

		expect(
			classifyGenerationFailure(new Error('Provider timeout while generating image'))
		).toMatchObject({
			category: 'provider',
			retryable: true,
		})
	})

	test('reads structured submission and execution metadata', () => {
		expect(
			getGenerationSubmissionMetadata({
				submission: {
					additionalInstructions: ' Keep windows clear ',
					retryAttempt: 2,
					submittedAt: '2026-04-01T12:00:00.000Z',
					trigger: 'retry',
				},
			})
		).toMatchObject({
			additionalInstructions: 'Keep windows clear',
			retryAttempt: 2,
			trigger: 'retry',
		})

		expect(
			getGenerationExecutionMetadata({
				execution: {
					acceptedAt: '2026-04-01T12:00:00.000Z',
					lastHeartbeatAt: '2026-04-01T12:00:08.000Z',
					processingMode: 'request',
					queueDurationMs: 1200,
					runDurationMs: 9200,
					totalDurationMs: 10400,
					workerClaimToken: 'claim-1',
					workerId: 'runner-a',
					workerLeaseExpiresAt: '2026-04-01T12:02:08.000Z',
				},
			})
		).toMatchObject({
			lastHeartbeatAt: '2026-04-01T12:00:08.000Z',
			processingMode: 'request',
			queueDurationMs: 1200,
			runDurationMs: 9200,
			totalDurationMs: 10400,
			workerClaimToken: 'claim-1',
			workerId: 'runner-a',
			workerLeaseExpiresAt: '2026-04-01T12:02:08.000Z',
		})
	})

	test('detects active and expired worker leases', () => {
		const activeMetadata = {
			execution: {
				processingMode: 'worker',
				workerLeaseExpiresAt: '2026-04-01T12:02:08.000Z',
			},
		}
		const expiredMetadata = {
			execution: {
				processingMode: 'worker',
				workerLeaseExpiresAt: '2026-04-01T11:58:08.000Z',
			},
		}
		const now = new Date('2026-04-01T12:00:00.000Z')

		expect(hasActiveGenerationWorkerLease(activeMetadata, now)).toBe(true)
		expect(hasExpiredGenerationWorkerLease(activeMetadata, now)).toBe(false)
		expect(hasActiveGenerationWorkerLease(expiredMetadata, now)).toBe(false)
		expect(hasExpiredGenerationWorkerLease(expiredMetadata, now)).toBe(true)
	})

	test('reads billing and failure metadata', () => {
		expect(
			getGenerationBillingMetadata({
				billing: {
					chargedCredits: 8,
					refundReferenceId: 'generation:1:refund',
					refundedCredits: 8,
				},
			})
		).toMatchObject({
			chargedCredits: 8,
			refundReferenceId: 'generation:1:refund',
			refundedCredits: 8,
		})

		expect(
			getGenerationFailureMetadata({
				failure: {
					category: 'provider',
					failedAt: '2026-04-01T12:00:09.000Z',
					message: 'Provider timeout while generating image',
					retryable: true,
				},
			})
		).toMatchObject({
			category: 'provider',
			retryable: true,
		})
	})

	test('only allows queued jobs to be canceled', () => {
		expect(canCancelGenerationJob('queued')).toBe(true)
		expect(canCancelGenerationJob('processing')).toBe(false)
		expect(canCancelGenerationJob('failed')).toBe(false)
	})

	test('normalizes blank additional instructions to null', () => {
		expect(normalizeAdditionalInstructions('   ')).toBeNull()
		expect(normalizeAdditionalInstructions(' Keep the fireplace clear ')).toBe(
			'Keep the fireplace clear'
		)
	})
})
