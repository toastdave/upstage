import {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	getIncludedCreditsFromFeatureFlags,
} from '$lib/server/billing-helpers'
import { db } from '$lib/server/db'
import { creditLedger, plan, userEntitlement } from '@upstage/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

export {
	buildGenerationChargeDescription,
	buildGenerationRefundDescription,
	buildInsufficientCreditsMessage,
	getIncludedCreditsFromFeatureFlags,
}

type BillingReader = Pick<typeof db, 'select'>
type BillingWriter = BillingReader & Pick<typeof db, 'insert'>

export type BillingPlanSnapshot = {
	id: string
	includedCredits: number
	name: string
	slug: string
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

export type BillingSnapshot = {
	creditBalance: number
	currentPlan: BillingPlanSnapshot
	recentLedger: BillingLedgerEntry[]
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

export async function loadUserBillingSnapshot(userId: string): Promise<BillingSnapshot> {
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
			.limit(5)

		return {
			creditBalance,
			currentPlan,
			recentLedger,
		}
	})
}
