import { describe, expect, test } from 'bun:test'
import { createProjectSlug, normalizeOptionalText, parseProjectType } from './projects'

describe('project server helpers', () => {
	test('creates readable slugs with a suffix', () => {
		const slug = createProjectSlug('Sunlit Primary Suite Redesign')

		expect(slug).toMatch(/^sunlit-primary-suite-redesign-[a-z0-9]{6}$/)
	})

	test('normalizes optional text values', () => {
		expect(normalizeOptionalText('  loft listing  ', 40)).toBe('loft listing')
		expect(normalizeOptionalText('   ', 40)).toBeNull()
	})

	test('accepts only known project types', () => {
		expect(parseProjectType('virtual_staging')).toBe('virtual_staging')
		expect(parseProjectType('unknown')).toBeNull()
	})
})
