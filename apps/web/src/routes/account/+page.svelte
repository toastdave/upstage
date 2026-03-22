<script lang="ts">
import { goto, invalidateAll } from '$app/navigation'
import { authClient } from '$lib/auth-client'
import type { PageData } from './$types'

const { data } = $props<{ data: PageData }>()

let errorMessage = $state('')
let isSigningOut = $state(false)

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
	<title>Account | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="grid gap-6 lg:grid-cols-[1fr_1fr]">
		<div class="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
			<p class="font-display text-sm uppercase tracking-[0.3em] text-moss-500">Account</p>
			<h1 class="mt-4 font-display text-4xl leading-none text-ink-950">Hi, {data.user.name}.</h1>
			<p class="mt-4 max-w-xl text-base leading-8 text-ink-700">
				Your auth foundation is live. This account is ready for projects, credits, generation history, and billing settings.
			</p>

			<div class="mt-8 grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
					<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Email</p>
					<p class="mt-2 text-sm font-semibold text-ink-950">{data.user.email}</p>
				</div>
				<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
					<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Email verified</p>
					<p class="mt-2 text-sm font-semibold text-ink-950">{data.user.emailVerified ? 'Verified' : 'Not yet verified'}</p>
				</div>
				<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
					<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Session ID</p>
					<p class="mt-2 text-sm font-semibold text-ink-950 break-all">{data.session.id}</p>
				</div>
				<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
					<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Session expires</p>
					<p class="mt-2 text-sm font-semibold text-ink-950">{new Date(data.session.expiresAt).toLocaleString()}</p>
				</div>
			</div>
		</div>

		<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
			<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">What is ready now</p>
			<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
				<li>Email + password sign-up and sign-in</li>
				<li>Google OAuth callback wiring</li>
				<li>GitHub OAuth callback wiring</li>
				<li>SSR session hydration via SvelteKit locals</li>
				<li>Credits-ready schema and planning docs</li>
			</ul>

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
</section>
