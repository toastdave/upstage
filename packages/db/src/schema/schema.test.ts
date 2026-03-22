import { describe, expect, test } from 'bun:test'
import { creditLedger, generationJob, project, sourceAsset } from './index'

describe('database schema', () => {
	test('project table exposes expected columns', () => {
		expect(project.title.name).toBe('title')
		expect(project.projectType.name).toBe('project_type')
	})

	test('generation jobs and source assets are linked for orchestration', () => {
		expect(generationJob.sourceAssetId.name).toBe('source_asset_id')
		expect(sourceAsset.storageKey.name).toBe('storage_key')
	})

	test('credit ledger stores signed entries', () => {
		expect(creditLedger.amount.name).toBe('amount')
	})
})
