import { describe, expect, test } from 'bun:test'
import {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	getIncludedCreditsFromFeatureFlags,
} from './billing-helpers'

describe('billing helpers', () => {
	test('reads included credits from plan feature flags', () => {
		expect(getIncludedCreditsFromFeatureFlags({ includedCredits: 15 })).toBe(15)
		expect(getIncludedCreditsFromFeatureFlags({ includedCredits: -4 })).toBe(0)
		expect(getIncludedCreditsFromFeatureFlags({})).toBe(0)
		expect(getIncludedCreditsFromFeatureFlags(null)).toBe(0)
	})

	test('builds generation ledger descriptions', () => {
		expect(buildGenerationChargeDescription('Maple Street living room')).toBe(
			'Accepted generation for Maple Street living room'
		)
		expect(buildGenerationRefundDescription('Maple Street living room')).toBe(
			'Refunded failed generation for Maple Street living room'
		)
	})

	test('formats an insufficient credits message', () => {
		expect(buildInsufficientCreditsMessage(3, 7)).toBe(
			'You need 7 credits for this generation, but only have 3. Add credits before continuing.'
		)
	})
})
