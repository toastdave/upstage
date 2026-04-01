import { describe, expect, test } from 'bun:test'
import {
	extractUpstageUserIdFromPolarPayload,
	mapPolarCustomerStateToEntitlement,
	normalizePolarServerMode,
} from './polar-helpers'

describe('polar helpers', () => {
	test('normalizes server mode to sandbox by default', () => {
		expect(normalizePolarServerMode(undefined)).toBe('sandbox')
		expect(normalizePolarServerMode('sandbox')).toBe('sandbox')
		expect(normalizePolarServerMode('production')).toBe('production')
	})

	test('maps Polar customer state to the local entitlement model', () => {
		expect(
			mapPolarCustomerStateToEntitlement(
				{
					active_subscriptions: [{ id: 'sub_1', product_id: 'prod_pro', status: 'active' }],
					id: 'cus_1',
				},
				'prod_pro'
			)
		).toEqual({
			planId: 'pro',
			polarCustomerId: 'cus_1',
			polarSubscriptionId: 'sub_1',
			status: 'active',
		})

		expect(
			mapPolarCustomerStateToEntitlement(
				{
					active_subscriptions: [],
					id: 'cus_1',
				},
				'prod_pro'
			)
		).toEqual({
			planId: 'free',
			polarCustomerId: 'cus_1',
			polarSubscriptionId: null,
			status: 'free',
		})
	})

	test('extracts the Upstage user id from common Polar payload shapes', () => {
		expect(
			extractUpstageUserIdFromPolarPayload({
				data: {
					metadata: {
						upstageUserId: 'user_123',
					},
				},
			})
		).toBe('user_123')

		expect(
			extractUpstageUserIdFromPolarPayload({
				data: {
					customer: {
						external_id: 'user_456',
					},
				},
			})
		).toBe('user_456')

		expect(extractUpstageUserIdFromPolarPayload({})).toBeNull()
	})
})
