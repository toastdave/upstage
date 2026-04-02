import { db } from '$lib/server/db'
import {
	type GenerationOperationsSnapshot,
	loadGenerationOperationsSnapshot,
} from '$lib/server/generation-jobs'
import {
	getGenerationBillingMetadata,
	getGenerationExecutionMetadata,
	getGenerationFailureMetadata,
	getGenerationSubmissionMetadata,
} from '$lib/server/generation-orchestration'
import { generationJob, project, user } from '@upstage/db/schema'
import { and, asc, desc, eq, sql } from 'drizzle-orm'

type GenerationOperationsJobRecord = {
	completedAt: Date | null
	createdAt: Date
	creditCost: number
	errorMessage: string | null
	id: string
	model: string
	ownerEmail: string
	ownerName: string
	projectSlug: string
	projectTitle: string
	provider: string
	requestMetadata: unknown
	responseMetadata: unknown
	status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
	updatedAt: Date
}

export type GenerationOperationsJobSummary = {
	billing: ReturnType<typeof getGenerationBillingMetadata>
	completedAt: Date | null
	createdAt: Date
	creditCost: number
	errorMessage: string | null
	execution: ReturnType<typeof getGenerationExecutionMetadata>
	failure: ReturnType<typeof getGenerationFailureMetadata>
	id: string
	model: string
	ownerEmail: string
	ownerName: string
	projectSlug: string
	projectTitle: string
	provider: string
	status: GenerationOperationsJobRecord['status']
	submission: ReturnType<typeof getGenerationSubmissionMetadata>
	updatedAt: Date
}

export type GenerationOperationsConsole = {
	activeWorkerJobs: GenerationOperationsJobSummary[]
	recentFailures: GenerationOperationsJobSummary[]
	snapshot: GenerationOperationsSnapshot
	stalledJobs: GenerationOperationsJobSummary[]
	queuedJobs: GenerationOperationsJobSummary[]
}

function summarizeOperationsJob(
	job: GenerationOperationsJobRecord
): GenerationOperationsJobSummary {
	return {
		billing: getGenerationBillingMetadata(job.responseMetadata),
		completedAt: job.completedAt,
		createdAt: job.createdAt,
		creditCost: job.creditCost,
		errorMessage: job.errorMessage,
		execution: getGenerationExecutionMetadata(job.responseMetadata),
		failure: getGenerationFailureMetadata(job.responseMetadata),
		id: job.id,
		model: job.model,
		ownerEmail: job.ownerEmail,
		ownerName: job.ownerName,
		projectSlug: job.projectSlug,
		projectTitle: job.projectTitle,
		provider: job.provider,
		status: job.status,
		submission: getGenerationSubmissionMetadata(job.requestMetadata),
		updatedAt: job.updatedAt,
	}
}

async function loadGenerationJobsForOperations(options: {
	limit: number
	orderBy: 'created_asc' | 'updated_asc' | 'updated_desc'
	where: ReturnType<typeof and> | ReturnType<typeof eq> | ReturnType<typeof sql>
}) {
	const query = db
		.select({
			completedAt: generationJob.completedAt,
			createdAt: generationJob.createdAt,
			creditCost: generationJob.creditCost,
			errorMessage: generationJob.errorMessage,
			id: generationJob.id,
			model: generationJob.model,
			ownerEmail: user.email,
			ownerName: user.name,
			projectSlug: project.slug,
			projectTitle: project.title,
			provider: generationJob.provider,
			requestMetadata: generationJob.requestMetadata,
			responseMetadata: generationJob.responseMetadata,
			status: generationJob.status,
			updatedAt: generationJob.updatedAt,
		})
		.from(generationJob)
		.innerJoin(project, eq(project.id, generationJob.projectId))
		.innerJoin(user, eq(user.id, project.ownerUserId))
		.where(options.where)
		.limit(options.limit)

	const rows =
		options.orderBy === 'created_asc'
			? await query.orderBy(generationJob.createdAt)
			: options.orderBy === 'updated_asc'
				? await query.orderBy(generationJob.updatedAt)
				: await query.orderBy(desc(generationJob.updatedAt))

	return rows.map((row) =>
		summarizeOperationsJob({
			...row,
			status: row.status as GenerationOperationsJobRecord['status'],
		})
	)
}

export async function loadGenerationOperationsConsole(
	limit = 8
): Promise<GenerationOperationsConsole> {
	const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20)

	const [snapshot, queuedJobs, activeWorkerJobs, stalledJobs, recentFailures] = await Promise.all([
		loadGenerationOperationsSnapshot(),
		loadGenerationJobsForOperations({
			limit: safeLimit,
			orderBy: 'created_asc',
			where: eq(generationJob.status, 'queued'),
		}),
		loadGenerationJobsForOperations({
			limit: safeLimit,
			orderBy: 'updated_desc',
			where: and(
				eq(generationJob.status, 'processing'),
				sql`(${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker'`,
				sql`(${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null`,
				sql`((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) > now()`
			),
		}),
		loadGenerationJobsForOperations({
			limit: safeLimit,
			orderBy: 'updated_asc',
			where: and(
				eq(generationJob.status, 'processing'),
				sql`(${generationJob.responseMetadata} -> 'execution' ->> 'processingMode') = 'worker'`,
				sql`(${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt') is not null`,
				sql`((${generationJob.responseMetadata} -> 'execution' ->> 'workerLeaseExpiresAt')::timestamptz) <= now()`
			),
		}),
		loadGenerationJobsForOperations({
			limit: safeLimit,
			orderBy: 'updated_desc',
			where: eq(generationJob.status, 'failed'),
		}),
	])

	return {
		activeWorkerJobs,
		recentFailures,
		snapshot,
		stalledJobs,
		queuedJobs,
	}
}
