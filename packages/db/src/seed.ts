import { createDb } from './client'
import { generationPreset, plan } from './schema/index'

const db = createDb()

await db
	.insert(plan)
	.values([
		{
			id: 'free',
			slug: 'free',
			name: 'Free',
			monthlyPriceCents: 0,
			annualPriceCents: 0,
			featureFlags: {
				includedCredits: 15,
				maxProjects: 3,
				maxTeamMembers: 1,
				highResolutionExports: false,
			},
		},
		{
			id: 'pro',
			slug: 'pro',
			name: 'Pro',
			monthlyPriceCents: 3900,
			annualPriceCents: 39000,
			featureFlags: {
				includedCredits: 120,
				maxProjects: 50,
				maxTeamMembers: 3,
				highResolutionExports: true,
			},
		},
	])
	.onConflictDoNothing()

await db
	.insert(generationPreset)
	.values([
		{
			id: 'airy-staging',
			slug: 'airy-staging',
			name: 'Airy Staging',
			category: 'virtual_staging',
			promptTemplate:
				'Stage the room with bright neutral furnishings, balanced natural light, and listing-photo realism.',
			defaultAspectRatio: '4:3',
		},
		{
			id: 'luxury-redesign',
			slug: 'luxury-redesign',
			name: 'Luxury Redesign',
			category: 'existing_room_redesign',
			promptTemplate:
				'Redesign the room with premium materials, warm architectural lighting, and a polished editorial finish.',
			defaultAspectRatio: '4:3',
		},
		{
			id: 'scandinavian-refresh',
			slug: 'scandinavian-refresh',
			name: 'Scandinavian Refresh',
			category: 'empty_room_design',
			promptTemplate:
				'Design the empty room with Scandinavian furniture, soft oak tones, crisp textiles, and clean daylight.',
			defaultAspectRatio: '4:3',
		},
	])
	.onConflictDoNothing()

console.log('Seeded plans and generation presets')
