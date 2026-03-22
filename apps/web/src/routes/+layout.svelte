<script lang="ts">
import './layout.css'
import favicon from '$lib/assets/favicon.svg'
import { siteConfig } from '$lib/config/site'
import type { LayoutData } from './$types'

const { children, data } = $props<{ data: LayoutData; children: import('svelte').Snippet }>()
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="relative min-h-screen overflow-x-clip">
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,226,163,0.34),transparent_30%),radial-gradient(circle_at_80%_14%,rgba(108,151,122,0.2),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(209,122,90,0.22),transparent_28%)]"></div>

	<div class="relative mx-auto flex max-w-6xl items-center justify-between px-6 pt-6 sm:px-8 lg:px-10">
		<a class="flex items-center gap-3 text-ink-950" href="/">
			<span class="rounded-full bg-ink-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-paper-100">
				{siteConfig.name}
			</span>
			<span class="hidden text-sm text-ink-700 sm:inline">{siteConfig.tagline}</span>
		</a>

		<nav class="flex items-center gap-3 text-sm">
			{#if data.user}
				<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-ink-700 backdrop-blur" href="/account">
					{data.user.name}
				</a>
			{:else}
				<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-ink-700 backdrop-blur" href="/auth/sign-in">
					Sign in
				</a>
				<a class="rounded-full bg-ink-950 px-4 py-2 font-medium text-paper-100" href="/auth/sign-up">
					Create account
				</a>
			{/if}
		</nav>
	</div>

	{@render children()}
</div>
