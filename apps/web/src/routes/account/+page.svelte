<script lang="ts">
import { goto, invalidateAll } from '$app/navigation'
import { authClient } from '$lib/auth-client'
import {
	formatProjectType,
	projectTypeCards,
	propertyTypeOptions,
	roomTypeOptions,
} from '$lib/projects'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

const createProjectValues = $derived(form?.form === 'createProject' ? form.values : null)

let errorMessage = $state('')
let isSigningOut = $state(false)
let selectedProjectType = $state('virtual_staging')

$effect(() => {
	selectedProjectType = createProjectValues?.projectType ?? 'virtual_staging'
})

const heroStats = $derived([
	{ label: 'Projects', value: String(data.projectCount) },
	{ label: 'Source photos', value: String(data.sourcePhotoCount) },
	{ label: 'Credits', value: String(data.billing.creditBalance) },
])

function formatLedgerAmount(amount: number) {
	return `${amount > 0 ? '+' : ''}${amount}`
}

function formatLedgerEntryType(entryType: string) {
	return entryType.replaceAll('_', ' ')
}

async function signOut() {
	isSigningOut = true
	errorMessage = ''

	const result = await authClient.signOut()

	isSigningOut = false

	if (result.error) {
		errorMessage = result.error.message ?? 'Unable to sign out right now.'
		return
	}

	await invalidateAll()
	await goto('/')
}
</script>

<svelte:head>
	<title>Workspace | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-moss-500">Workspace</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">
					Build staged and redesigned room concepts faster.
				</h1>
				<p class="mt-4 max-w-2xl text-base leading-8 text-ink-700">
					Create a project for each listing or room, upload source photos, and keep future generations grouped in one place.
				</p>

				<div class="mt-8 grid gap-4 sm:grid-cols-3">
					{#each heroStats as stat (stat.label)}
						<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
							<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{stat.label}</p>
							<p class="mt-2 font-display text-3xl text-ink-950">{stat.value}</p>
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Your projects</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Current listings and room concepts</h2>
					</div>
					<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href="#new-project">
						New project
					</a>
				</div>

				{#if data.projects.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No projects yet. Start with a listing or room, then upload the first source photo to prepare for generation.
					</div>
				{:else}
					<div class="mt-6 grid gap-4 lg:grid-cols-2">
						{#each data.projects as item (item.id)}
							<a class="rounded-[1.75rem] border border-ink-950/10 bg-paper-100/70 p-5 transition hover:-translate-y-0.5 hover:border-ink-950/20 hover:bg-white" href={`/account/projects/${item.slug}`}>
								<div class="flex items-start justify-between gap-4">
									<div>
										<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{formatProjectType(item.projectType)}</p>
										<h3 class="mt-2 font-display text-2xl text-ink-950">{item.title}</h3>
									</div>
									<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
										{item.status}
									</span>
								</div>

								<div class="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
									{#if item.roomType}
										<span class="rounded-full bg-white px-3 py-1">{item.roomType}</span>
									{/if}
									{#if item.propertyType}
										<span class="rounded-full bg-white px-3 py-1">{item.propertyType}</span>
									{/if}
									{#if item.locationLabel}
										<span class="rounded-full bg-white px-3 py-1">{item.locationLabel}</span>
									{/if}
								</div>

								<div class="mt-5 flex items-center justify-between text-sm text-ink-700">
									<span>{item.activeAssetCount} source photo{item.activeAssetCount === 1 ? '' : 's'}</span>
									<span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="new-project">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">New project</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Set up the next room transformation</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">
					Choose the workflow first. You can refine room details and upload source photos on the next screen.
				</p>

				<form class="mt-6 space-y-5" method="POST" action="?/createProject">
					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="title">Project title</label>
						<input class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="title" maxlength="140" name="title" placeholder="Example: Maple Street living room staging" required type="text" value={createProjectValues?.title ?? ''} />
					</div>

					<div class="space-y-3">
						<p class="text-sm font-medium text-ink-900">Workflow</p>
						<div class="grid gap-3">
							{#each projectTypeCards as card (card.value)}
								<label class="cursor-pointer rounded-[1.5rem] border px-4 py-4 transition {selectedProjectType === card.value ? 'border-moss-500 bg-moss-500/8' : 'border-ink-950/10 bg-paper-100/75'}">
									<input bind:group={selectedProjectType} class="sr-only" name="projectType" type="radio" value={card.value} />
									<p class="font-semibold text-ink-950">{card.label}</p>
									<p class="mt-2 text-sm leading-7 text-ink-700">{card.description}</p>
								</label>
							{/each}
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="roomType">Room type</label>
							<select class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="roomType" name="roomType">
								<option value="">Select a room</option>
								{#each roomTypeOptions as option (option)}
									<option selected={createProjectValues?.roomType === option} value={option}>{option}</option>
								{/each}
							</select>
						</div>

						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="propertyType">Property type</label>
							<select class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="propertyType" name="propertyType">
								<option value="">Select a property</option>
								{#each propertyTypeOptions as option (option)}
									<option selected={createProjectValues?.propertyType === option} value={option}>{option}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="styleIntent">Style direction</label>
						<input class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="styleIntent" maxlength="120" name="styleIntent" placeholder="Modern coastal, warm minimal, luxury rental..." type="text" value={createProjectValues?.styleIntent ?? ''} />
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="locationLabel">Location label</label>
						<input class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="locationLabel" maxlength="160" name="locationLabel" placeholder="Austin condo, Palm Springs rental, etc." type="text" value={createProjectValues?.locationLabel ?? ''} />
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="notes">Notes</label>
						<textarea class="min-h-28 w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="notes" maxlength="1000" name="notes" placeholder="What should stay true to the space? Who is the intended buyer or renter?">{createProjectValues?.notes ?? ''}</textarea>
					</div>

					{#if form?.form === 'createProject' && form.error}
						<p class="rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
							{form.error}
						</p>
					{/if}

					<button class="w-full rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" type="submit">
						Create project
					</button>
				</form>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Account</p>
				{#if data.billingNotice}
					<p class={`mt-5 rounded-2xl border px-4 py-3 text-sm ${data.billingNotice.tone === 'success' ? 'border-moss-500/20 bg-moss-500/10 text-moss-500' : data.billingNotice.tone === 'error' ? 'border-terracotta-500/20 bg-terracotta-500/10 text-terracotta-500' : 'border-ink-950/10 bg-paper-100/80 text-ink-700'}`}>
						{data.billingNotice.message}
					</p>
				{/if}
				<div class="mt-5 space-y-4 text-sm text-ink-700">
					<div>
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Signed in as</p>
						<p class="mt-2 font-semibold text-ink-950">{data.user.name}</p>
						<p class="text-ink-700">{data.user.email}</p>
					</div>

					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Session expires</p>
						<p class="mt-2 font-semibold text-ink-950">{new Date(data.session.expiresAt).toLocaleString()}</p>
					</div>

					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Current plan</p>
						<p class="mt-2 font-semibold text-ink-950">{data.billing.currentPlan.name}</p>
						<p class="mt-1 leading-7">Includes {data.billing.currentPlan.includedCredits} starter credits in the current seeded billing model.</p>
						<p class="mt-2 text-xs uppercase tracking-[0.22em] text-ink-700/70">{data.billing.polar.environmentLabel}</p>
						<div class="mt-4 flex flex-wrap gap-3" id="billing">
							<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href="/account/billing">
								Open billing
							</a>
							{#if data.billing.polar.checkoutReady}
								<a class="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-100" href="/account/billing/checkout">
									Start sandbox checkout
								</a>
							{:else}
								<p class="rounded-full border border-terracotta-500/15 bg-terracotta-500/8 px-4 py-2 text-sm text-terracotta-500">
									Add `POLAR_ACCESS_TOKEN` and `POLAR_PRO_PRODUCT_ID` to enable checkout.
								</p>
							{/if}

							{#if data.billing.polar.customerPortalReady}
								<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href="/account/billing/portal">
									Open customer portal
								</a>
							{/if}
						</div>
					</div>

					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Next milestone</p>
						<p class="mt-2 leading-7">Async generation now has a dedicated worker runtime and operations console. The next launch-risk work is richer billing fulfillment, gallery depth, and account polish.</p>
					</div>

					{#if data.operationsConsoleEnabled}
						<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
							<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Operations</p>
							<p class="mt-2 leading-7">Open the internal operations console to inspect queued jobs, active worker leases, stalled runs, and recent failures while deferred processing is enabled.</p>
							<div class="mt-4">
								<a class="inline-flex rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href="/account/ops">
									Open operations console
								</a>
							</div>
						</div>
					{/if}

					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<div class="flex items-center justify-between gap-4">
							<div>
								<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Recent credit activity</p>
								<p class="mt-2 font-semibold text-ink-950">Balance {data.billing.creditBalance} credits</p>
								<p class="mt-1 text-sm leading-7 text-ink-700">
									Polar state: {data.billing.polar.state.replaceAll('_', ' ')}
								</p>
							</div>
						</div>

						<div class="mt-4 space-y-3">
							{#each data.billing.recentLedger as entry (entry.id)}
								<div class="rounded-2xl border border-ink-950/8 bg-white px-4 py-4">
									<div class="flex items-start justify-between gap-4">
										<div>
											<p class="text-xs uppercase tracking-[0.22em] text-ink-700/70">{formatLedgerEntryType(entry.entryType)}</p>
											<p class="mt-2 text-sm leading-7 text-ink-950">{entry.description ?? 'Credit balance updated'}</p>
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

				<div class="mt-8 flex flex-wrap gap-3">
					<a class="rounded-full border border-ink-950/10 bg-white px-5 py-3 text-sm font-semibold text-ink-900" href="/">
						Back home
					</a>
					<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100 disabled:cursor-not-allowed disabled:opacity-70" disabled={isSigningOut} onclick={signOut} type="button">
						{isSigningOut ? 'Signing out...' : 'Sign out'}
					</button>
				</div>

				{#if errorMessage}
					<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{errorMessage}
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>
