import { describe, expect, test } from 'bun:test'
import { creditLedger, generationImage, generationJob, project, sourceAsset } from './index'

describe('database schema', () => {
	test('project table exposes expected columns', () => {
		expect(project.title.name).toBe('title')
		expect(project.projectType.name).toBe('project_type')
	})

	test('generation jobs and source assets are linked for orchestration', () => {
		expect(generationJob.sourceAssetId.name).toBe('source_asset_id')
		expect(generationJob.idempotencyKey.name).toBe('idempotency_key')
		expect(sourceAsset.storageKey.name).toBe('storage_key')
		expect(sourceAsset.roomBrief.name).toBe('room_brief')
		expect(sourceAsset.roomBriefStatus.name).toBe('room_brief_status')
		expect(sourceAsset.archivedAt.name).toBe('archived_at')
		expect(generationImage.isFavorite.name).toBe('is_favorite')
		expect(generationImage.mimeType.name).toBe('mime_type')
	})

	test('credit ledger stores signed entries', () => {
		expect(creditLedger.amount.name).toBe('amount')
	})
})
