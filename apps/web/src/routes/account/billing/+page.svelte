<script lang="ts">
import type { PageData } from './$types'

const { data } = $props<{ data: PageData }>()

function formatLedgerAmount(amount: number) {
	return `${amount > 0 ? '+' : ''}${amount}`
}

function formatLedgerEntryType(entryType: string) {
	return entryType.replaceAll('_', ' ')
}

function formatWebhookEventName(eventName: string) {
	return eventName.replaceAll('.', ' ')
}

function formatPolarState(state: string) {
	return state.replaceAll('_', ' ')
}

function buildBillingActionUrl(path: '/account/billing/checkout' | '/account/billing/portal') {
	return `${path}?returnTo=${encodeURIComponent('/account/billing')}`
}
</script>

<svelte:head>
	<title>Billing | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href="/account">
			Back to workspace
		</a>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{data.billing.polar.environmentLabel}
		</span>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			Polar state: {formatPolarState(data.billing.polar.state)}
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-moss-500">Billing</p>
				{#if data.billingNotice}
					<p class={`mt-5 rounded-2xl border px-4 py-3 text-sm ${data.billingNotice.tone === 'success' ? 'border-moss-500/20 bg-moss-500/10 text-moss-500' : data.billingNotice.tone === 'error' ? 'border-terracotta-500/20 bg-terracotta-500/10 text-terracotta-500' : 'border-ink-950/10 bg-paper-100/80 text-ink-700'}`}>
						{data.billingNotice.message}
					</p>
				{/if}
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">
					Manage credits, Polar checkout, and hosted billing sync.
				</h1>
				<p class="mt-4 max-w-2xl text-base leading-8 text-ink-700">
					This page combines the credit ledger, Polar sandbox integration state, and recent webhook activity so you can validate billing without leaving the workspace.
				</p>

				<div class="mt-8 grid gap-4 sm:grid-cols-3">
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Current plan</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{data.billing.currentPlan.name}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Available credits</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{data.billing.creditBalance}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Included credits</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{data.billing.currentPlan.includedCredits}</p>
					</div>
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Sandbox actions</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Run the hosted billing flow</h2>
						<p class="mt-3 max-w-3xl text-sm leading-7 text-ink-700">
							Use the same account-level entrypoints your future customers will hit, but keep them anchored to the Polar sandbox environment until validation is complete.
						</p>
					</div>
				</div>

				<div class="mt-6 flex flex-wrap gap-3">
					{#if data.billing.polar.checkoutReady}
						<a class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" href={buildBillingActionUrl('/account/billing/checkout')}>
							Start sandbox checkout
						</a>
					{:else}
						<p class="rounded-full border border-terracotta-500/15 bg-terracotta-500/8 px-4 py-3 text-sm text-terracotta-500">
							Add `POLAR_ACCESS_TOKEN` and `POLAR_PRO_PRODUCT_ID` before testing checkout.
						</p>
					{/if}

					{#if data.billing.polar.customerPortalReady}
						<a class="rounded-full border border-ink-950/10 bg-white px-5 py-3 text-sm font-semibold text-ink-900" href={buildBillingActionUrl('/account/billing/portal')}>
							Open customer portal
						</a>
					{:else}
						<p class="rounded-full border border-ink-950/10 bg-paper-100/80 px-4 py-3 text-sm text-ink-700">
							Customer portal becomes available after Polar recognizes this account as a customer.
						</p>
					{/if}
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Credit ledger</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Balance changes</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.billing.recentLedger.length} entries
					</span>
				</div>

				<div class="mt-6 space-y-4">
					{#each data.billing.recentLedger as entry (entry.id)}
						<div class="rounded-[1.5rem] border border-ink-950/10 bg-paper-100/70 p-5">
							<div class="flex items-start justify-between gap-4">
								<div>
									<p class="text-xs uppercase tracking-[0.22em] text-ink-700/70">{formatLedgerEntryType(entry.entryType)}</p>
									<p class="mt-2 text-sm leading-7 text-ink-950">{entry.description ?? 'Balance updated'}</p>
								</div>
								<p class={`rounded-full px-3 py-1 text-xs font-semibold ${entry.amount >= 0 ? 'bg-moss-500/12 text-moss-500' : 'bg-terracotta-500/12 text-terracotta-500'}`}>
									{formatLedgerAmount(entry.amount)} credits
								</p>
							</div>
							<p class="mt-3 text-xs uppercase tracking-[0.22em] text-ink-700/70">
								{new Date(entry.createdAt).toLocaleString()}
								{#if entry.balanceAfter !== null}
									 - Balance after {entry.balanceAfter}
								{/if}
							</p>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Integration status</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Polar sandbox readiness</h2>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Access token: {data.billing.polar.accessTokenConfigured ? 'configured' : 'missing'}</li>
					<li>Pro product: {data.billing.polar.proProductConfigured ? 'configured' : 'missing'}</li>
					<li>Webhook secret: {data.billing.polar.webhookReady ? 'configured' : 'missing'}</li>
					<li>Customer portal: {data.billing.polar.customerPortalReady ? 'ready' : 'waiting on Polar customer state'}</li>
				</ul>

				<div class="mt-5 rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4 text-sm leading-7 text-ink-700">
					<p class="font-semibold text-ink-950">Webhook endpoint</p>
					<p class="mt-2 break-all">{data.polarWebhookUrl}</p>
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Webhook audit</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Recent Polar events</h2>
						<p class="mt-3 text-sm leading-7 text-ink-700">
							These are the most recent user-scoped webhook events we recorded for this account.
						</p>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.recentEvents.length} events
					</span>
				</div>

				{#if data.recentEvents.length === 0}
					<div class="mt-6 rounded-[1.5rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No user-scoped webhook events yet. Complete a sandbox checkout, then use Polar redelivery if you need to validate replay behavior.
					</div>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.recentEvents as event (event.id)}
							<div class="rounded-[1.5rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<div class="flex items-start justify-between gap-4">
									<div>
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/70">{formatWebhookEventName(event.eventName)}</p>
										<p class="mt-2 text-sm leading-7 text-ink-950">Provider event {event.providerEventId}</p>
									</div>
									<span class={`rounded-full px-3 py-1 text-xs font-semibold ${event.processedAt ? 'bg-moss-500/12 text-moss-500' : 'bg-terracotta-500/12 text-terracotta-500'}`}>
										{event.processedAt ? 'Processed' : 'Pending'}
									</span>
								</div>
								<p class="mt-3 text-xs uppercase tracking-[0.22em] text-ink-700/70">
									Received {new Date(event.createdAt).toLocaleString()}
									{#if event.processedAt}
										 - Processed {new Date(event.processedAt).toLocaleString()}
									{/if}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Sandbox checklist</p>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Add `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, and `POLAR_PRO_PRODUCT_ID` to `.env`.</li>
					<li>Configure the Polar sandbox webhook endpoint to point at `{data.polarWebhookUrl}`.</li>
					<li>Run a sandbox checkout and confirm the entitlement changes from free to pro.</li>
					<li>Use Polar redelivery to confirm webhook replays stay idempotent.</li>
				</ul>
			</div>
		</div>
	</div>
</section>
