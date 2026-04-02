<script lang="ts">
import { resolve } from '$app/paths'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

type OperationsJob = PageData['operations']['queuedJobs'][number]

function formatDurationFromNow(value: Date | string | null) {
	if (!value) {
		return null
	}

	const timestamp = new Date(value).getTime()

	if (!Number.isFinite(timestamp)) {
		return null
	}

	const diffMs = Math.max(Date.now() - timestamp, 0)
	const seconds = Math.round(diffMs / 1000)

	if (seconds < 60) {
		return `${seconds}s ago`
	}

	const minutes = Math.floor(seconds / 60)

	if (minutes < 60) {
		return `${minutes}m ago`
	}

	const hours = Math.floor(minutes / 60)

	if (hours < 24) {
		return `${hours}h ago`
	}

	return `${Math.floor(hours / 24)}d ago`
}

function isLeaseActive(job: OperationsJob) {
	if (!job.execution.workerLeaseExpiresAt) {
		return false
	}

	return new Date(job.execution.workerLeaseExpiresAt).getTime() > Date.now()
}

function formatBillingDelta(job: OperationsJob) {
	const refunded = job.billing.refundedCredits ?? 0

	return refunded > 0
		? `Charged ${job.creditCost}, refunded ${refunded}`
		: `Charged ${job.creditCost}`
}

const statCards = $derived([
	{ label: 'Queued', value: String(data.operations.snapshot.queuedCount) },
	{ label: 'Active workers', value: String(data.operations.snapshot.activeWorkerCount) },
	{ label: 'Expired leases', value: String(data.operations.snapshot.expiredLeaseCount) },
	{ label: 'Failed jobs', value: String(data.operations.snapshot.failedCount) },
])
</script>

<svelte:head>
	<title>Operations | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href={resolve('/account')}>
			Back to workspace
		</a>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			Deferred worker operations
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-terracotta-500">Operations console</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">
					Inspect queue health, worker leases, and recovery actions.
				</h1>
				<p class="mt-4 max-w-3xl text-base leading-8 text-ink-700">
					This console is for support and launch-readiness work while deferred generation runs through the dedicated background worker runtime.
				</p>

				<div class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{#each statCards as stat (stat.label)}
						<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
							<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{stat.label}</p>
							<p class="mt-2 font-display text-3xl text-ink-950">{stat.value}</p>
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Recovery actions</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Nudge the queue forward</h2>
						<p class="mt-3 max-w-2xl text-sm leading-7 text-ink-700">
							Use these controls when you want a manual recovery pass without opening a shell for `bun run worker`.
						</p>
					</div>
				</div>

				<div class="mt-6 flex flex-wrap gap-3">
					<form method="POST" action="?/processNext">
						<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" type="submit">
							Process next job
						</button>
					</form>

					<form class="flex flex-wrap items-center gap-3" method="POST" action="?/processBatch">
						<label class="text-sm font-medium text-ink-900" for="batch-limit">Batch size</label>
						<input class="w-20 rounded-full border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950" id="batch-limit" max="10" min="1" name="limit" type="number" value={form?.form === 'processBatch' ? form.values?.limit ?? '3' : '3'} />
						<button class="rounded-full border border-ink-950/10 bg-white px-5 py-3 text-sm font-semibold text-ink-900" type="submit">
							Drain batch
						</button>
					</form>
				</div>

				{#if form?.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if form?.error}
					<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{form.error}
					</p>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Queued jobs</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Waiting for a worker claim</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.operations.queuedJobs.length} visible
					</span>
				</div>

				{#if data.operations.queuedJobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No queued jobs right now.
					</div>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.operations.queuedJobs as job (job.id)}
							<div class="rounded-[1.5rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<div class="flex flex-wrap items-start justify-between gap-4">
									<div>
										<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{job.provider}</p>
										<h3 class="mt-2 font-display text-2xl text-ink-950">{job.projectTitle}</h3>
										<p class="mt-2 text-sm leading-7 text-ink-700">
											Owner: {job.ownerName} ({job.ownerEmail})
										</p>
									</div>
									<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
										Queued {formatDurationFromNow(job.createdAt)}
									</span>
								</div>

								<div class="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
									<span class="rounded-full bg-white px-3 py-1">{job.id}</span>
									<span class="rounded-full bg-white px-3 py-1">{job.projectSlug}</span>
									<span class="rounded-full bg-white px-3 py-1">{formatBillingDelta(job)}</span>
								</div>

								<div class="mt-4 flex flex-wrap gap-3">
									<form method="POST" action="?/processJob">
										<input name="generationJobId" type="hidden" value={job.id} />
										<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="submit">
											Process this job
										</button>
									</form>
									<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href={resolve(`/account/projects/${job.projectSlug}`)}>
										Open project
									</a>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Stalled jobs</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Expired worker leases</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.operations.stalledJobs.length} visible
					</span>
				</div>

				{#if data.operations.stalledJobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No expired worker leases right now.
					</div>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.operations.stalledJobs as job (job.id)}
							<div class="rounded-[1.5rem] border border-terracotta-500/15 bg-terracotta-500/8 p-5">
								<p class="text-xs uppercase tracking-[0.24em] text-terracotta-500">Worker {job.execution.workerId ?? 'unknown'}</p>
								<h3 class="mt-2 font-display text-2xl text-ink-950">{job.projectTitle}</h3>
								<p class="mt-2 text-sm leading-7 text-ink-700">
									Lease expired {formatDurationFromNow(job.execution.workerLeaseExpiresAt)}. Last heartbeat {formatDurationFromNow(job.execution.lastHeartbeatAt)}.
								</p>

								<div class="mt-4 flex flex-wrap gap-3">
									<form method="POST" action="?/cancelStalledJob">
										<input name="generationJobId" type="hidden" value={job.id} />
										<button class="rounded-full border border-terracotta-500/15 bg-white px-4 py-2 text-sm font-semibold text-terracotta-500" type="submit">
											Cancel stalled job
										</button>
									</form>
									<form method="POST" action="?/processJob">
										<input name="generationJobId" type="hidden" value={job.id} />
										<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="submit">
											Reclaim and process
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Worker defaults</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Runtime configuration</h2>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Batch size: {data.workerDefaults.batchSize} jobs</li>
					<li>Poll interval: {data.workerDefaults.pollIntervalSeconds}s</li>
					<li>Lease duration: {data.workerDefaults.leaseSeconds}s</li>
					<li>Heartbeat interval: {data.workerDefaults.heartbeatIntervalSeconds}s</li>
					<li>Idle exit: {data.workerDefaults.idleExitSeconds ? `${data.workerDefaults.idleExitSeconds}s` : 'disabled'}</li>
				</ul>
				<div class="mt-5 rounded-2xl border border-ink-950/10 bg-paper-100/80 px-4 py-4 text-sm leading-7 text-ink-700">
					Run the dedicated worker with `bun run worker` for continuous background processing or `bun run worker:once` for one recovery pass.
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Active workers</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Live leases</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.operations.activeWorkerJobs.length} visible
					</span>
				</div>

				{#if data.operations.activeWorkerJobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No worker leases are active right now.
					</div>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.operations.activeWorkerJobs as job (job.id)}
							<div class="rounded-[1.5rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{job.execution.workerId ?? 'worker'}</p>
								<h3 class="mt-2 font-display text-2xl text-ink-950">{job.projectTitle}</h3>
								<p class="mt-2 text-sm leading-7 text-ink-700">
									{isLeaseActive(job) ? 'Lease active' : 'Lease pending refresh'} until {job.execution.workerLeaseExpiresAt ? new Date(job.execution.workerLeaseExpiresAt).toLocaleString() : 'unknown'}.
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Recent failures</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Support follow-up</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.operations.recentFailures.length} visible
					</span>
				</div>

				{#if data.operations.recentFailures.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No recent failures.
					</div>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.operations.recentFailures as job (job.id)}
							<div class="rounded-[1.5rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<p class="text-xs uppercase tracking-[0.24em] text-terracotta-500">{job.failure?.category ?? 'unknown'} failure</p>
								<h3 class="mt-2 font-display text-2xl text-ink-950">{job.projectTitle}</h3>
								<p class="mt-2 text-sm leading-7 text-ink-700">{job.errorMessage ?? job.failure?.message ?? 'Generation failed without a stored error message.'}</p>
								<p class="mt-3 text-xs uppercase tracking-[0.22em] text-ink-700/70">
									{job.failure?.retryable ? 'Retryable' : 'Requires intervention'} - {formatDurationFromNow(job.updatedAt)}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
