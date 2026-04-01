import { describe, expect, test } from 'bun:test'
import {
	buildGenerationAttemptKey,
	buildGenerationSubmissionKey,
	classifyGenerationFailure,
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

	test('normalizes blank additional instructions to null', () => {
		expect(normalizeAdditionalInstructions('   ')).toBeNull()
		expect(normalizeAdditionalInstructions(' Keep the fireplace clear ')).toBe(
			'Keep the fireplace clear'
		)
	})
})
