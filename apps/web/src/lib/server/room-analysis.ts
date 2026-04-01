import {
	type RoomBrief,
	buildFallbackRoomBrief,
	buildRoomBriefSummary,
	normalizeRoomBrief,
} from '$lib/room-briefs'
import { getAiRuntimeConfig } from '$lib/server/ai/config'

type DraftRoomBriefInput = {
	project: {
		locationLabel: string | null
		notes: string | null
		projectType: string
		propertyType: string | null
		roomType: string | null
		styleIntent: string | null
		title: string
	}
	sourceAsset: {
		height: number | null
		mimeType: string
		originalFilename: string | null
		width: number | null
	}
	sourceImage: Uint8Array
}

function extractJsonObject(content: string) {
	const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i)

	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim()
	}

	const firstBrace = content.indexOf('{')
	const lastBrace = content.lastIndexOf('}')

	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		return null
	}

	return content.slice(firstBrace, lastBrace + 1)
}

function parseRoomBriefPatch(content: string) {
	const json = extractJsonObject(content)

	if (!json) {
		return null
	}

	try {
		const parsed = JSON.parse(json)

		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}

async function fetchLocalRoomBriefPatch(input: DraftRoomBriefInput) {
	const config = getAiRuntimeConfig()
	const response = await fetch(`${config.localBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: config.localAnalysisModel,
			messages: [
				{
					role: 'user',
					content: [
						'Analyze this room photo and return JSON only.',
						'Use these exact string keys: roomType, propertyType, styleDirection, lightingConditions, architecturalAnchors, existingFurniture, protectedElements, requestedChanges, realismGuidance, notes.',
						'Keep each value concise, practical, and safe for image-generation planning.',
						`Known project title: ${input.project.title}.`,
						input.project.roomType ? `Known room type: ${input.project.roomType}.` : null,
						input.project.propertyType
							? `Known property type: ${input.project.propertyType}.`
							: null,
						input.project.styleIntent ? `Known style intent: ${input.project.styleIntent}.` : null,
						input.project.locationLabel
							? `Location context: ${input.project.locationLabel}.`
							: null,
						input.project.notes ? `Existing notes: ${input.project.notes}.` : null,
					]
						.filter(Boolean)
						.join(' '),
					images: [Buffer.from(input.sourceImage).toString('base64')],
				},
			],
			stream: false,
			format: 'json',
		}),
	})

	if (!response.ok) {
		throw new Error(`Local room analysis failed with status ${response.status}`)
	}

	const payload = (await response.json()) as {
		message?: {
			content?: string
		}
	}

	return parseRoomBriefPatch(payload.message?.content ?? '')
}

export async function buildDraftRoomBrief(input: DraftRoomBriefInput): Promise<{
	brief: RoomBrief
	summary: string
}> {
	const fallback = buildFallbackRoomBrief({
		project: input.project,
		sourceAsset: {
			originalFilename: input.sourceAsset.originalFilename,
		},
	})

	try {
		const patch = await fetchLocalRoomBriefPatch(input)
		const brief = normalizeRoomBrief(patch, fallback)

		return {
			brief,
			summary: buildRoomBriefSummary(brief),
		}
	} catch {
		return {
			brief: fallback,
			summary: buildRoomBriefSummary(fallback),
		}
	}
}
