<script lang="ts">
import { resolve } from '$app/paths'
import { siteConfig } from '$lib/config/site'
import type { PageData } from './$types'

const { data } = $props<{ data: PageData }>()

const epics = [
	'Platform foundation',
	'Authentication and accounts',
	'Projects and uploads',
	'Generation orchestration',
	'Staging and design workflows',
	'Galleries and deliverables',
	'Credits and billing',
	'Presets and personalization',
	'Trust and safety',
	'Observability and operations',
	'Growth and collaboration',
]

const stack = [
	'SvelteKit monolith',
	'Bun workspaces + Bun SSR adapter',
	'Drizzle + Postgres',
	'Better Auth + Polar',
	'AI SDK + Vercel AI Gateway',
	'MinIO + Docker Compose + mise',
]

const workflows = [
	{
		name: 'Virtual staging',
		description:
			'Turn empty listings into market-ready spaces with furniture, styling, and lighting direction.',
	},
	{
		name: 'Interior design',
		description:
			'Explore style directions for empty rooms before buying furniture or pitching a renovation.',
	},
	{
		name: 'Room redesign',
		description:
			'Remix existing spaces while preserving layout clues, windows, and architectural character.',
	},
]
</script>

<svelte:head>
	<title>Upstage</title>
	<meta name="description" content={siteConfig.description} />
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
	<header class="grid gap-8 rounded-[2rem] border border-white/70 bg-white/72 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur md:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
		<div class="space-y-6">
			<div class="flex flex-wrap items-center gap-3 text-sm font-medium text-ink-700">
				<span class="rounded-full bg-ink-950 px-3 py-1 text-paper-100">AI interiors</span>
				<span class="rounded-full border border-ink-950/10 px-3 py-1">Real estate</span>
				<span class="rounded-full border border-ink-950/10 px-3 py-1">Usage-based credits</span>
			</div>
			<p class="font-display text-sm uppercase tracking-[0.3em] text-terracotta-500">{siteConfig.tagline}</p>
			<h1 class="max-w-3xl font-display text-5xl leading-none tracking-tight text-ink-950 sm:text-6xl">
				AI-generated photos for listings, redesign pitches, and empty-room transformations.
			</h1>
			<p class="max-w-2xl text-lg leading-8 text-ink-700">
				This foundation locks the stack, wires auth and Drizzle, seeds credits and presets,
				and documents the roadmap for building Upstage into a polished staging workflow.
			</p>
			<div class="flex flex-wrap gap-3">
				{#if data.user}
					<a class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" href={resolve('/account')}>
						Open account
					</a>
				{:else}
					<a class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" href={resolve('/auth/sign-up?redirectTo=/account')}>
						Create an account
					</a>
					<a class="rounded-full border border-ink-950/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink-700" href={resolve('/auth/sign-in?redirectTo=/account')}>
						Sign in
					</a>
				{/if}
				<a class="rounded-full border border-ink-950/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink-700" href={resolve('/pricing')}>
					View pricing
				</a>
			</div>
		</div>

		<div class="rounded-[1.5rem] border border-ink-950/10 bg-ink-950 p-6 text-paper-100">
			<p class="text-sm uppercase tracking-[0.28em] text-gold-300">Core loop</p>
			<ul class="mt-4 space-y-3 text-sm leading-7 text-paper-100/90">
				<li>Upload the room photo and choose a workflow.</li>
				<li>Apply staged, redesigned, or style-led directions in minutes.</li>
				<li>Spend credits predictably with room for premium tiers later.</li>
			</ul>
		</div>
	</header>

	<section class="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
		<div class="rounded-[1.75rem] border border-ink-950/10 bg-white/80 p-7 shadow-[0_24px_80px_-56px_rgba(18,36,40,0.6)] backdrop-blur">
			<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Locked stack</p>
			<ul class="mt-5 grid gap-3 text-sm text-ink-900 sm:grid-cols-2">
				{#each stack as item (item)}
					<li class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-3">{item}</li>
				{/each}
			</ul>
		</div>

		<div class="rounded-[1.75rem] border border-ink-950/10 bg-white/80 p-7 shadow-[0_24px_80px_-56px_rgba(18,36,40,0.6)] backdrop-blur">
			<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Planning coverage</p>
			<div class="mt-5 grid gap-3 text-sm text-ink-900 sm:grid-cols-2">
				{#each epics as epic (epic)}
					<div class="rounded-2xl border border-ink-950/8 bg-white px-4 py-3">{epic}</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="mt-8 grid gap-6 lg:grid-cols-3">
		{#each workflows as workflow (workflow.name)}
			<div class="rounded-[1.75rem] border border-dashed border-ink-950/15 bg-white/65 p-6 backdrop-blur">
				<p class="font-display text-2xl text-ink-950">{workflow.name}</p>
				<p class="mt-3 text-sm leading-7 text-ink-700">{workflow.description}</p>
			</div>
		{/each}
	</section>

	<section class="mt-8 rounded-[1.75rem] border border-ink-950/10 bg-white/75 p-7 shadow-[0_24px_80px_-56px_rgba(18,36,40,0.6)] backdrop-blur">
		<p class="font-display text-lg text-ink-950">What this scaffold already includes</p>
		<div class="mt-4 grid gap-4 md:grid-cols-3">
			<div class="rounded-2xl bg-white/90 p-5">
				<p class="font-semibold text-ink-950">Auth + account shell</p>
				<p class="mt-2 text-sm leading-7 text-ink-700">Better Auth, protected account route, and starter sign-in and sign-up screens.</p>
			</div>
			<div class="rounded-2xl bg-white/90 p-5">
				<p class="font-semibold text-ink-950">Credits-ready schema</p>
				<p class="mt-2 text-sm leading-7 text-ink-700">Projects, source assets, generation jobs, presets, plans, entitlements, and credit ledger tables.</p>
			</div>
			<div class="rounded-2xl bg-white/90 p-5">
				<p class="font-semibold text-ink-950">Product planning</p>
				<p class="mt-2 text-sm leading-7 text-ink-700">A roadmap and PRDs for the next build phases live in `docs/prds`.</p>
			</div>
		</div>
	</section>
</div>
