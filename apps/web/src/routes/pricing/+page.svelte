<script lang="ts">
import { resolve } from '$app/paths'
import type { PageData } from './$types'

const { data } = $props<{ data: PageData }>()

function formatPrice(cents: number) {
	if (cents === 0) {
		return 'Free'
	}

	return new Intl.NumberFormat('en-US', {
		currency: 'USD',
		style: 'currency',
	}).format(cents / 100)
}
</script>

<svelte:head>
	<title>Pricing | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="rounded-[2rem] border border-white/70 bg-white/78 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
		<p class="font-display text-sm uppercase tracking-[0.3em] text-terracotta-500">Pricing</p>
		<h1 class="mt-4 font-display text-5xl leading-none text-ink-950 sm:text-6xl">
			Credits-first plans for staging, redesign, and listing prep.
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-8 text-ink-700">
			Start with a free workspace, then move into the Pro plan when you need more credits, more projects, and higher-resolution deliverables.
		</p>
	</div>

	<div class="mt-8 grid gap-6 lg:grid-cols-2">
		{#each data.plans as plan (plan.id)}
			<div class={`rounded-[2rem] border p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur ${plan.slug === 'pro' ? 'border-ink-950/15 bg-ink-950 text-paper-100' : 'border-ink-950/10 bg-white/85 text-ink-950'}`}>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class={`text-sm uppercase tracking-[0.28em] ${plan.slug === 'pro' ? 'text-gold-300' : 'text-moss-500'}`}>{plan.name}</p>
						<p class="mt-4 font-display text-5xl leading-none">{formatPrice(plan.monthlyPriceCents)}</p>
						<p class={`mt-2 text-sm ${plan.slug === 'pro' ? 'text-paper-100/75' : 'text-ink-700'}`}>per month{#if plan.annualPriceCents && plan.annualPriceCents > 0} - {formatPrice(plan.annualPriceCents)} annually{/if}</p>
					</div>
					{#if plan.slug === 'pro'}
						<span class="rounded-full bg-paper-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-ink-950">
							Most capable
						</span>
					{/if}
				</div>

				<div class={`mt-6 rounded-[1.5rem] border px-5 py-5 ${plan.slug === 'pro' ? 'border-paper-100/10 bg-paper-100/6' : 'border-ink-950/10 bg-paper-100/80'}`}>
					<p class="text-xs uppercase tracking-[0.24em] opacity-70">Included credits</p>
					<p class="mt-2 font-display text-4xl">{plan.includedCredits}</p>
				</div>

				<ul class={`mt-6 space-y-3 text-sm leading-7 ${plan.slug === 'pro' ? 'text-paper-100/85' : 'text-ink-700'}`}>
					<li>{plan.maxProjects ?? 'Unlimited'} project capacity in the current seeded plan model</li>
					<li>{plan.maxTeamMembers ?? 'Unlimited'} team member{plan.maxTeamMembers === 1 ? '' : 's'} supported</li>
					<li>{plan.highResolutionExports ? 'High-resolution deliverables included' : 'Standard deliverables included'}</li>
				</ul>

				<div class="mt-8 flex flex-wrap gap-3">
					{#if data.user}
						{#if plan.slug === 'pro'}
							<a class={`rounded-full px-5 py-3 text-sm font-semibold ${plan.slug === 'pro' ? 'bg-paper-100 text-ink-950' : 'bg-ink-950 text-paper-100'}`} href={resolve('/account/billing/checkout')}>
								Upgrade in sandbox
							</a>
						{:else}
							<a class={`rounded-full px-5 py-3 text-sm font-semibold ${plan.slug === 'pro' ? 'bg-paper-100 text-ink-950' : 'bg-ink-950 text-paper-100'}`} href={resolve('/account')}>
								Open workspace
							</a>
						{/if}
					{:else}
						<a class={`rounded-full px-5 py-3 text-sm font-semibold ${plan.slug === 'pro' ? 'bg-paper-100 text-ink-950' : 'bg-ink-950 text-paper-100'}`} href={resolve('/auth/sign-up?redirectTo=/pricing')}>
							Create account
						</a>
					{/if}
					<a class={`rounded-full border px-5 py-3 text-sm font-semibold ${plan.slug === 'pro' ? 'border-paper-100/15 bg-transparent text-paper-100' : 'border-ink-950/10 bg-white text-ink-900'}`} href={resolve('/account/billing')}>
						Billing details
					</a>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-8 rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
		<p class="text-sm uppercase tracking-[0.28em] text-moss-500">How credits behave</p>
		<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
			<li>Generation cost is shown before a run starts.</li>
			<li>Credits are deducted when a job is accepted.</li>
			<li>Failed or canceled runs create compensating refunds so balance changes stay traceable.</li>
			<li>Polar sandbox stays the default hosted billing environment until production rollout is validated.</li>
		</ul>
	</div>
</section>
