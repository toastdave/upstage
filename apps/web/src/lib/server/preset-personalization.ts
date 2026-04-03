import { aspectRatioOptions } from '$lib/generation'
import type { ProjectType } from '$lib/projects'
import { db } from '$lib/server/db'
import { parseProjectType } from '$lib/server/projects'
import { generationPreset, userPreference, userPresetPreference } from '@upstage/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'

type AspectRatioPreference = (typeof aspectRatioOptions)[number]['value']

const supportedAspectRatios = new Set<AspectRatioPreference>(
	aspectRatioOptions.map((option) => option.value)
)

export type UserGenerationPreferences = {
	defaultAspectRatio: AspectRatioPreference
	defaultProjectType: ProjectType
}

export const defaultGenerationPreferences: UserGenerationPreferences = {
	defaultAspectRatio: '4:3',
	defaultProjectType: 'virtual_staging',
}

export type PersonalizedPreset = {
	category: string
	defaultAspectRatio: string
	id: string
	isFavorite: boolean
	isFeatured: boolean
	lastUsedAt: Date | null
	name: string
	promptTemplate: string
	slug: string
	useCount: number
}

function sortPersonalizedPresets(a: PersonalizedPreset, b: PersonalizedPreset) {
	if (a.isFavorite !== b.isFavorite) {
		return a.isFavorite ? -1 : 1
	}

	if (a.lastUsedAt && b.lastUsedAt) {
		return b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
	}

	if (a.lastUsedAt || b.lastUsedAt) {
		return a.lastUsedAt ? -1 : 1
	}

	if (a.isFeatured !== b.isFeatured) {
		return a.isFeatured ? -1 : 1
	}

	if (a.category !== b.category) {
		return a.category.localeCompare(b.category)
	}

	return a.name.localeCompare(b.name)
}

export function parseDefaultAspectRatio(value: FormDataEntryValue | null) {
	if (typeof value !== 'string') {
		return null
	}

	return supportedAspectRatios.has(value as AspectRatioPreference)
		? (value as AspectRatioPreference)
		: null
}

export async function loadUserGenerationPreferences(
	userId: string
): Promise<UserGenerationPreferences> {
	const [record] = await db
		.select({
			defaultAspectRatio: userPreference.defaultAspectRatio,
			defaultProjectType: userPreference.defaultProjectType,
		})
		.from(userPreference)
		.where(eq(userPreference.userId, userId))
		.limit(1)

	if (!record) {
		return { ...defaultGenerationPreferences }
	}

	return {
		defaultAspectRatio: supportedAspectRatios.has(
			record.defaultAspectRatio as AspectRatioPreference
		)
			? (record.defaultAspectRatio as AspectRatioPreference)
			: defaultGenerationPreferences.defaultAspectRatio,
		defaultProjectType:
			parseProjectType(record.defaultProjectType) ??
			defaultGenerationPreferences.defaultProjectType,
	}
}

export async function saveUserGenerationPreferences(options: {
	defaultAspectRatio: AspectRatioPreference
	defaultProjectType: UserGenerationPreferences['defaultProjectType']
	userId: string
}) {
	const now = new Date()

	await db
		.insert(userPreference)
		.values({
			createdAt: now,
			defaultAspectRatio: options.defaultAspectRatio,
			defaultProjectType: options.defaultProjectType,
			updatedAt: now,
			userId: options.userId,
		})
		.onConflictDoUpdate({
			target: userPreference.userId,
			set: {
				defaultAspectRatio: options.defaultAspectRatio,
				defaultProjectType: options.defaultProjectType,
				updatedAt: now,
			},
		})

	return {
		defaultAspectRatio: options.defaultAspectRatio,
		defaultProjectType: options.defaultProjectType,
	}
}

export async function loadUserPresetCatalog(userId: string): Promise<PersonalizedPreset[]> {
	const rows = await db
		.select({
			category: generationPreset.category,
			defaultAspectRatio: generationPreset.defaultAspectRatio,
			id: generationPreset.id,
			isFavorite: userPresetPreference.isFavorite,
			isFeatured: generationPreset.isFeatured,
			lastUsedAt: userPresetPreference.lastUsedAt,
			name: generationPreset.name,
			promptTemplate: generationPreset.promptTemplate,
			slug: generationPreset.slug,
			useCount: userPresetPreference.useCount,
		})
		.from(generationPreset)
		.leftJoin(
			userPresetPreference,
			and(
				eq(userPresetPreference.presetId, generationPreset.id),
				eq(userPresetPreference.userId, userId)
			)
		)
		.orderBy(
			asc(generationPreset.category),
			desc(generationPreset.isFeatured),
			asc(generationPreset.name)
		)

	return rows
		.map((row) => ({
			category: row.category,
			defaultAspectRatio: row.defaultAspectRatio,
			id: row.id,
			isFavorite: row.isFavorite ?? false,
			isFeatured: row.isFeatured,
			lastUsedAt: row.lastUsedAt ?? null,
			name: row.name,
			promptTemplate: row.promptTemplate,
			slug: row.slug,
			useCount: Number(row.useCount ?? 0),
		}))
		.sort(sortPersonalizedPresets)
}

export function buildUserPresetCollections(presets: PersonalizedPreset[]) {
	const favorites = presets.filter((preset) => preset.isFavorite)
	const recent = presets
		.filter((preset) => preset.lastUsedAt)
		.sort((a, b) => {
			if (!a.lastUsedAt || !b.lastUsedAt) {
				return 0
			}

			return b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
		})
		.slice(0, 4)

	return {
		favorites,
		recent,
	}
}

export async function toggleUserPresetFavorite(options: { presetId: string; userId: string }) {
	const [presetRecord] = await db
		.select({ id: generationPreset.id, name: generationPreset.name })
		.from(generationPreset)
		.where(eq(generationPreset.id, options.presetId))
		.limit(1)

	if (!presetRecord) {
		return null
	}

	const [existingPreference] = await db
		.select({
			isFavorite: userPresetPreference.isFavorite,
			lastUsedAt: userPresetPreference.lastUsedAt,
			useCount: userPresetPreference.useCount,
		})
		.from(userPresetPreference)
		.where(
			and(
				eq(userPresetPreference.userId, options.userId),
				eq(userPresetPreference.presetId, options.presetId)
			)
		)
		.limit(1)

	const isFavorite = !(existingPreference?.isFavorite ?? false)
	const now = new Date()

	if (existingPreference) {
		await db
			.update(userPresetPreference)
			.set({ isFavorite, updatedAt: now })
			.where(
				and(
					eq(userPresetPreference.userId, options.userId),
					eq(userPresetPreference.presetId, options.presetId)
				)
			)
	} else {
		await db.insert(userPresetPreference).values({
			createdAt: now,
			isFavorite,
			lastUsedAt: null,
			presetId: options.presetId,
			updatedAt: now,
			useCount: 0,
			userId: options.userId,
		})
	}

	return {
		isFavorite,
		presetId: presetRecord.id,
		presetName: presetRecord.name,
	}
}
