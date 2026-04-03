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
			id: 'warm-minimal-staging',
			slug: 'warm-minimal-staging',
			name: 'Warm Minimal Staging',
			category: 'virtual_staging',
			promptTemplate:
				'Stage the room with warm oak accents, restrained decor, soft texture, and clean realtor-grade realism.',
			defaultAspectRatio: '4:3',
		},
		{
			id: 'coastal-open-house',
			slug: 'coastal-open-house',
			name: 'Coastal Open House',
			category: 'virtual_staging',
			promptTemplate:
				'Stage the room for a bright coastal showing with breezy textiles, pale woods, soft blue accents, and realistic daylight.',
			defaultAspectRatio: '16:9',
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
			id: 'boutique-hotel-redesign',
			slug: 'boutique-hotel-redesign',
			name: 'Boutique Hotel Redesign',
			category: 'existing_room_redesign',
			promptTemplate:
				'Redesign the room with boutique-hotel layering, sculptural furniture, rich texture, and elevated but believable lighting.',
			defaultAspectRatio: '3:4',
		},
		{
			id: 'heritage-modern-refresh',
			slug: 'heritage-modern-refresh',
			name: 'Heritage Modern Refresh',
			category: 'existing_room_redesign',
			promptTemplate:
				'Redesign the room with updated finishes and modern furniture while respecting original trim, millwork, and architectural character.',
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
		{
			id: 'sunlit-family-design',
			slug: 'sunlit-family-design',
			name: 'Sunlit Family Design',
			category: 'empty_room_design',
			promptTemplate:
				'Design the empty room for everyday family living with durable materials, layered seating, warm neutrals, and sunlit realism.',
			defaultAspectRatio: '16:9',
		},
		{
			id: 'editorial-loft-concept',
			slug: 'editorial-loft-concept',
			name: 'Editorial Loft Concept',
			category: 'empty_room_design',
			promptTemplate:
				'Design the empty room with loft-inspired furniture, bold contrast, gallery-like styling, and realistic editorial photography cues.',
			defaultAspectRatio: '3:4',
		},
	])
	.onConflictDoNothing()

console.log('Seeded plans and generation presets')
