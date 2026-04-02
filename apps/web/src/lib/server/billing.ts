import {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	getIncludedCreditsFromFeatureFlags,
} from '$lib/server/billing-helpers'
import { db } from '$lib/server/db'
import {
	type PolarPublicConfig,
	fetchPolarCustomerState,
	getPolarPublicConfig,
} from '$lib/server/polar'
import {
	extractUpstageUserIdFromPolarPayload,
	mapPolarCustomerStateToEntitlement,
} from '$lib/server/polar-helpers'
import { billingEvent, creditLedger, plan, userEntitlement } from '@upstage/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

export {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	getIncludedCreditsFromFeatureFlags,
}

type BillingReader = Pick<typeof db, 'select'>
type BillingWriter = BillingReader & Pick<typeof db, 'insert' | 'update'>

type PolarBillingState = 'configured' | 'customer_missing' | 'not_configured' | 'sync_error'

export type BillingPlanSnapshot = {
	id: string
	includedCredits: number
	name: string
	slug: string
}

export type PricingPlanSnapshot = BillingPlanSnapshot & {
	annualPriceCents: number | null
	highResolutionExports: boolean
	maxProjects: number | null
	maxTeamMembers: number | null
	monthlyPriceCents: number
}

export type BillingLedgerEntry = {
	amount: number
	balanceAfter: number | null
	createdAt: Date
	description: string | null
	entryType: 'grant' | 'purchase' | 'generation' | 'adjustment' | 'refund'
	id: string
	referenceId: string | null
}

export type PolarBillingSnapshot = {
	accessTokenConfigured: boolean
	checkoutReady: boolean
	customerPortalReady: boolean
	environmentLabel: string
	proProductConfigured: boolean
	server: PolarPublicConfig['server']
	state: PolarBillingState
	webhookReady: boolean
}

export type BillingSnapshot = {
	creditBalance: number
	currentPlan: BillingPlanSnapshot
	polar: PolarBillingSnapshot
	recentLedger: BillingLedgerEntry[]
}

export type BillingEventSnapshot = {
	createdAt: Date
	eventName: string
	id: string
	processedAt: Date | null
	providerEventId: string
}

async function loadPlanSnapshot(executor: BillingReader, userId: string) {
	const [currentPlan] = await executor
		.select({
			featureFlags: plan.featureFlags,
			id: plan.id,
			name: plan.name,
			slug: plan.slug,
		})
		.from(userEntitlement)
		.innerJoin(plan, eq(plan.id, userEntitlement.planId))
		.where(eq(userEntitlement.userId, userId))
		.orderBy(desc(userEntitlement.startsAt), desc(userEntitlement.createdAt))
		.limit(1)

	if (!currentPlan) {
		return null
	}

	return {
		id: currentPlan.id,
		includedCredits: getIncludedCreditsFromFeatureFlags(currentPlan.featureFlags),
		name: currentPlan.name,
		slug: currentPlan.slug,
	} satisfies BillingPlanSnapshot
}

async function loadFreePlanSnapshot(executor: BillingReader) {
	const [freePlan] = await executor
		.select({
			featureFlags: plan.featureFlags,
			id: plan.id,
			name: plan.name,
			slug: plan.slug,
		})
		.from(plan)
		.where(eq(plan.id, 'free'))
		.limit(1)

	if (!freePlan) {
		throw new Error('The free plan is not configured yet')
	}

	return {
		id: freePlan.id,
		includedCredits: getIncludedCreditsFromFeatureFlags(freePlan.featureFlags),
		name: freePlan.name,
		slug: freePlan.slug,
	} satisfies BillingPlanSnapshot
}

function readFeatureFlagNumber(featureFlags: unknown, key: 'maxProjects' | 'maxTeamMembers') {
	if (!featureFlags || typeof featureFlags !== 'object') {
		return null
	}

	const value = (featureFlags as Record<string, unknown>)[key]

	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null
}

function readFeatureFlagBoolean(featureFlags: unknown, key: 'highResolutionExports') {
	if (!featureFlags || typeof featureFlags !== 'object') {
		return false
	}

	return (featureFlags as Record<string, unknown>)[key] === true
}

async function loadLatestEntitlementRecord(executor: BillingReader, userId: string) {
	const [record] = await executor
		.select({
			id: userEntitlement.id,
		})
		.from(userEntitlement)
		.where(eq(userEntitlement.userId, userId))
		.orderBy(desc(userEntitlement.startsAt), desc(userEntitlement.createdAt))
		.limit(1)

	return record ?? null
}

export async function getCreditBalance(executor: BillingReader, userId: string) {
	const [{ creditBalance }] = await executor
		.select({
			creditBalance: sql<number>`coalesce(sum(${creditLedger.amount}), 0)`,
		})
		.from(creditLedger)
		.where(eq(creditLedger.userId, userId))

	return Number(creditBalance ?? 0)
}

export async function ensureUserBillingState(executor: BillingWriter, userId: string) {
	let currentPlan = await loadPlanSnapshot(executor, userId)

	if (!currentPlan) {
		currentPlan = await loadFreePlanSnapshot(executor)

		await executor.insert(userEntitlement).values({
			planId: currentPlan.id,
			status: 'free',
			userId,
		})
	}

	const includedCreditsReferenceId = `plan:${currentPlan.id}:included-credits:v1`

	if (currentPlan.includedCredits > 0) {
		const [existingGrant] = await executor
			.select({ id: creditLedger.id })
			.from(creditLedger)
			.where(
				and(
					eq(creditLedger.referenceId, includedCreditsReferenceId),
					eq(creditLedger.userId, userId)
				)
			)
			.limit(1)

		if (!existingGrant) {
			const creditBalance = await getCreditBalance(executor, userId)

			await executor.insert(creditLedger).values({
				amount: currentPlan.includedCredits,
				balanceAfter: creditBalance + currentPlan.includedCredits,
				description: `${currentPlan.name} plan included credits`,
				entryType: 'grant',
				referenceId: includedCreditsReferenceId,
				userId,
			})
		}
	}

	return currentPlan
}

export async function syncUserBillingStateWithPolar(userId: string) {
	const polarConfig = getPolarPublicConfig()

	if (!polarConfig.accessTokenConfigured) {
		return {
			customerPortalReady: false,
			state: 'not_configured' as const,
		}
	}

	try {
		const customerState = await fetchPolarCustomerState(userId)

		if (!customerState) {
			return {
				customerPortalReady: false,
				state: 'customer_missing' as const,
			}
		}

		const nextEntitlement = mapPolarCustomerStateToEntitlement(
			customerState,
			polarConfig.proProductId
		)

		await db.transaction(async (tx) => {
			await ensureUserBillingState(tx, userId)
			const latestEntitlement = await loadLatestEntitlementRecord(tx, userId)

			if (latestEntitlement) {
				await tx
					.update(userEntitlement)
					.set({
						planId: nextEntitlement.planId,
						polarCustomerId: nextEntitlement.polarCustomerId,
						polarSubscriptionId: nextEntitlement.polarSubscriptionId,
						status: nextEntitlement.status,
						updatedAt: new Date(),
					})
					.where(eq(userEntitlement.id, latestEntitlement.id))
			} else {
				await tx.insert(userEntitlement).values({
					planId: nextEntitlement.planId,
					polarCustomerId: nextEntitlement.polarCustomerId,
					polarSubscriptionId: nextEntitlement.polarSubscriptionId,
					status: nextEntitlement.status,
					userId,
				})
			}

			await ensureUserBillingState(tx, userId)
		})

		return {
			customerPortalReady: true,
			state: 'configured' as const,
		}
	} catch {
		return {
			customerPortalReady: false,
			state: 'sync_error' as const,
		}
	}
}

export async function loadRecentBillingEventsForUser(userId: string, limit = 10) {
	const recentEvents = await db
		.select({
			createdAt: billingEvent.createdAt,
			eventName: billingEvent.eventName,
			id: billingEvent.id,
			payload: billingEvent.payload,
			processedAt: billingEvent.processedAt,
			providerEventId: billingEvent.providerEventId,
		})
		.from(billingEvent)
		.orderBy(desc(billingEvent.createdAt))
		.limit(Math.max(limit * 6, 30))

	return recentEvents
		.filter((event) => extractUpstageUserIdFromPolarPayload(event.payload) === userId)
		.slice(0, limit)
		.map((event) => ({
			createdAt: event.createdAt,
			eventName: event.eventName,
			id: event.id,
			processedAt: event.processedAt,
			providerEventId: event.providerEventId,
		})) satisfies BillingEventSnapshot[]
}

export async function loadPricingPlans(): Promise<PricingPlanSnapshot[]> {
	const plans = await db
		.select({
			annualPriceCents: plan.annualPriceCents,
			featureFlags: plan.featureFlags,
			id: plan.id,
			monthlyPriceCents: plan.monthlyPriceCents,
			name: plan.name,
			slug: plan.slug,
		})
		.from(plan)
		.orderBy(plan.monthlyPriceCents, plan.name)

	return plans.map((entry) => ({
		annualPriceCents: entry.annualPriceCents,
		highResolutionExports: readFeatureFlagBoolean(entry.featureFlags, 'highResolutionExports'),
		id: entry.id,
		includedCredits: getIncludedCreditsFromFeatureFlags(entry.featureFlags),
		maxProjects: readFeatureFlagNumber(entry.featureFlags, 'maxProjects'),
		maxTeamMembers: readFeatureFlagNumber(entry.featureFlags, 'maxTeamMembers'),
		monthlyPriceCents: entry.monthlyPriceCents,
		name: entry.name,
		slug: entry.slug,
	}))
}

export async function loadUserBillingSnapshot(
	userId: string,
	options?: { ledgerLimit?: number }
): Promise<BillingSnapshot> {
	const ledgerLimit = options?.ledgerLimit ?? 5
	const polarConfig = getPolarPublicConfig()
	const polarState = await syncUserBillingStateWithPolar(userId)

	return db.transaction(async (tx) => {
		const currentPlan = await ensureUserBillingState(tx, userId)
		const creditBalance = await getCreditBalance(tx, userId)
		const recentLedger = await tx
			.select({
				amount: creditLedger.amount,
				balanceAfter: creditLedger.balanceAfter,
				createdAt: creditLedger.createdAt,
				description: creditLedger.description,
				entryType: creditLedger.entryType,
				id: creditLedger.id,
				referenceId: creditLedger.referenceId,
			})
			.from(creditLedger)
			.where(eq(creditLedger.userId, userId))
			.orderBy(desc(creditLedger.createdAt))
			.limit(ledgerLimit)

		return {
			creditBalance,
			currentPlan,
			polar: {
				accessTokenConfigured: polarConfig.accessTokenConfigured,
				checkoutReady: polarConfig.checkoutReady,
				customerPortalReady: polarState.customerPortalReady,
				environmentLabel: polarConfig.environmentLabel,
				proProductConfigured: polarConfig.proProductConfigured,
				server: polarConfig.server,
				state: polarState.state,
				webhookReady: polarConfig.webhookReady,
			},
			recentLedger,
		}
	})
}
