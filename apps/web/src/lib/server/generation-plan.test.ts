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
			roomBrief: {
				architecturalAnchors: 'Balcony doors, wall trim, window wall',
				existingFurniture:
					'Treat the room as empty except for built-in shelving and lighting fixtures.',
				lightingConditions: 'Preserve the soft afternoon light from the balcony doors.',
				notes: 'Keep the balcony doors visible',
				propertyType: 'Condo',
				protectedElements: 'Balcony doors, wall trim',
				realismGuidance: 'Keep the result photorealistic and listing friendly.',
				requestedChanges: 'Add warm oak furniture and keep the room airy.',
				roomType: 'Living room',
				styleDirection: 'Warm minimal',
			},
			roomBriefStatus: 'reviewed',
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
		expect(plan.compiledPrompt).toContain('Warm minimal')
		expect(plan.roomBrief.targetAspectRatio).toBe('4:3')
		expect(plan.roomBrief.analysisStatus).toBe('reviewed')
		expect(plan.creditEstimate).toBe(7)
	})
})
