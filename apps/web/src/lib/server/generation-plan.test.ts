import { describe, expect, test } from 'bun:test'
import { buildGenerationPlan } from './generation-plan'

describe('buildGenerationPlan', () => {
	test('includes the structured brief and prompt guidance', () => {
		const plan = buildGenerationPlan({
			additionalInstructions: 'Use warm oak furniture and avoid blue accents',
			aspectRatio: '4:3',
			preset: {
				category: 'virtual_staging',
				name: 'Airy Staging',
				promptTemplate: 'Stage the room with bright neutral furnishings.',
				slug: 'airy-staging',
			},
			project: {
				locationLabel: 'Austin condo',
				notes: 'Keep the balcony doors visible',
				projectType: 'virtual_staging',
				propertyType: 'Condo',
				roomType: 'Living room',
				styleIntent: 'Warm minimal',
				title: 'Mockingbird listing',
			},
			protectedElements: 'Balcony doors, wall trim',
			sourceAsset: {
				fileSizeBytes: 1024,
				height: 900,
				mimeType: 'image/jpeg',
				originalFilename: 'room.jpg',
				storageKey: 'source-assets/mock.jpg',
				width: 1200,
			},
		})

		expect(plan.compiledPrompt).toContain('Structured room brief JSON')
		expect(plan.compiledPrompt).toContain('Balcony doors, wall trim')
		expect(plan.roomBrief.targetAspectRatio).toBe('4:3')
		expect(plan.creditEstimate).toBe(7)
	})
})
