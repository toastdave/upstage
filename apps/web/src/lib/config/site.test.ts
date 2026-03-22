import { describe, expect, test } from 'bun:test'
import { siteConfig } from './site'

describe('siteConfig', () => {
	test('exposes the product name', () => {
		expect(siteConfig.name).toBe('Upstage')
	})
})
