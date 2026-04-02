<script lang="ts">
import { resolve } from '$app/paths'
import { formatAspectRatio } from '$lib/generation'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

type GeneratedImage = PageData['job']['images'][number]

function getInitialSelectedImageId() {
	return (
		data.job.images.find((image: GeneratedImage) => image.isFavorite)?.id ??
		data.job.images[0]?.id ??
		''
	)
}

let copiedImageId = $state('')
let selectedImageId = $state(getInitialSelectedImageId())

const selectedImage = $derived(
	data.job.images.find((image: GeneratedImage) => image.id === selectedImageId) ??
		data.job.images[0] ??
		null
)

function buildDownloadUrl(path: string) {
	return `${path}?download=1`
}

function formatDuration(durationMs: number | null) {
	if (durationMs === null || durationMs < 0) {
		return 'Not recorded'
	}

	if (durationMs < 1000) {
		return `${durationMs} ms`
	}

	const seconds = durationMs / 1000

	if (seconds < 60) {
		return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
	}

	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = Math.round(seconds % 60)

	return `${minutes}m ${remainingSeconds}s`
}

async function copyImageLink(imageId: string, path: string) {
	const url = new URL(path, window.location.origin).toString()
	await navigator.clipboard.writeText(url)
	copiedImageId = imageId
	window.setTimeout(() => {
		if (copiedImageId === imageId) {
			copiedImageId = ''
		}
	}, 1600)
}

function selectImage(imageId: string) {
	selectedImageId = imageId
}
</script>

<svelte:head>
	<title>{data.project.title} Job | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}/gallery`)}>
			Back to gallery
		</a>
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}`)}>
			Project workflow
		</a>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{data.job.status}
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-terracotta-500">Job detail</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">
					{data.job.styleLabel ?? 'Generated concept'}
				</h1>
				<p class="mt-4 max-w-3xl text-base leading-8 text-ink-700">
					Review one batch in detail, compare it against the source photo, and keep the best deliverable pinned as your favorite output.
				</p>

				<div class="mt-8 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
					<span class="rounded-full bg-paper-100 px-3 py-1">{data.job.provider}</span>
					<span class="rounded-full bg-paper-100 px-3 py-1">{formatAspectRatio(data.job.aspectRatio)}</span>
					<span class="rounded-full bg-paper-100 px-3 py-1">{data.job.model}</span>
					<span class="rounded-full bg-paper-100 px-3 py-1">{data.job.images.length} outputs</span>
				</div>
			</div>

			{#if form?.form === 'toggleFavorite' && form.message}
				<p class="rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
					{form.message}
				</p>
			{/if}

			{#if form?.form === 'toggleFavorite' && form.error}
				<p class="rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
					{form.error}
				</p>
			{/if}

			{#if selectedImage && data.job.sourceAsset}
				<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-6 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
					<div class="grid gap-4 lg:grid-cols-2">
						<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-paper-100/75">
							<div class="flex items-center justify-between border-b border-ink-950/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-ink-700">
								<span>Before</span>
								<span>{data.job.sourceAsset.originalFilename ?? 'Source photo'}</span>
							</div>
							<div class="aspect-[4/3] bg-ink-950/5">
								<img alt={data.job.sourceAsset.originalFilename ?? 'Source photo'} class="h-full w-full object-cover" src={data.job.sourceAsset.url} />
							</div>
						</div>

						<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-paper-100/75">
							<div class="flex items-center justify-between border-b border-ink-950/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-ink-700">
								<span>After</span>
								<span>{selectedImage.isFavorite ? 'Favorite' : `Output ${selectedImage.sortOrder + 1}`}</span>
							</div>
							<div class="aspect-[4/3] bg-ink-950/5">
								<img alt={data.job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={selectedImage.url} />
							</div>
							<div class="space-y-3 p-4 text-sm text-ink-700">
								<p>{selectedImage.mimeType}{#if selectedImage.width && selectedImage.height} - {selectedImage.width} x {selectedImage.height}{/if}</p>
								<div class="flex flex-wrap gap-3">
									<form method="POST" action="?/toggleFavorite">
										<input name="generationImageId" type="hidden" value={selectedImage.id} />
										<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="submit">
											{selectedImage.isFavorite ? 'Unfavorite' : 'Favorite'}
										</button>
									</form>
									<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="button" onclick={() => window.location.assign(buildDownloadUrl(selectedImage.url))}>
										Download
									</button>
									<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="button" onclick={() => copyImageLink(selectedImage.id, selectedImage.url)}>
										{copiedImageId === selectedImage.id ? 'Link copied' : 'Copy link'}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			{#if data.job.images.length > 1}
				<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-6 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Variants</p>
							<h2 class="mt-3 font-display text-3xl text-ink-950">Switch between saved outputs</h2>
						</div>
					</div>
					<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{#each data.job.images as image (image.id)}
							<button class={`overflow-hidden rounded-[1.5rem] border text-left transition ${selectedImageId === image.id ? 'border-moss-500 bg-white shadow-[0_18px_48px_-30px_rgba(77,130,92,0.6)]' : 'border-ink-950/10 bg-paper-100/75 hover:border-ink-950/20 hover:bg-white'}`} type="button" onclick={() => selectImage(image.id)}>
								<div class="aspect-[4/3] bg-ink-950/5">
									<img alt={data.job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={image.url} />
								</div>
								<div class="flex items-center justify-between gap-4 p-4 text-sm text-ink-700">
									<div>
										<p class="font-semibold text-ink-950">Output {image.sortOrder + 1}</p>
										<p class="mt-1">{image.mimeType}</p>
									</div>
									{#if image.isFavorite}
										<span class="rounded-full bg-moss-500/12 px-3 py-1 text-xs uppercase tracking-[0.24em] text-moss-500">Favorite</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Batch diagnostics</p>
				<div class="mt-5 grid gap-3">
					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-3 text-sm text-ink-700">
						<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Queue time</p>
						<p class="mt-2 text-ink-950">{formatDuration(data.job.execution.queueDurationMs)}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-3 text-sm text-ink-700">
						<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Run time</p>
						<p class="mt-2 text-ink-950">{formatDuration(data.job.execution.runDurationMs)}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-3 text-sm text-ink-700">
						<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Total lifecycle</p>
						<p class="mt-2 text-ink-950">{formatDuration(data.job.execution.totalDurationMs)}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-3 text-sm text-ink-700">
						<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Credits</p>
						<p class="mt-2 text-ink-950">Charged {data.job.billing.chargedCredits ?? data.job.creditCost}</p>
						<p class="mt-1 text-xs text-ink-700/70">{data.job.billing.refundedCredits ? `Refunded ${data.job.billing.refundedCredits}` : 'No refund recorded'}</p>
					</div>
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Run timeline</p>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Accepted {data.job.execution.acceptedAt ? new Date(data.job.execution.acceptedAt).toLocaleString() : 'not recorded'}</li>
					<li>Started {data.job.execution.startedAt ? new Date(data.job.execution.startedAt).toLocaleString() : 'not recorded'}</li>
					<li>Completed {data.job.execution.completedAt ? new Date(data.job.execution.completedAt).toLocaleString() : 'not recorded'}</li>
					<li>Worker {data.job.execution.workerId ?? 'not claimed by a worker'}</li>
				</ul>

				{#if data.job.errorMessage}
					<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{data.job.errorMessage}
					</p>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Browse nearby</p>
				<div class="mt-5 flex flex-wrap gap-3">
					<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}/gallery`)}>
						Open full gallery
					</a>
					<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}#job-timeline`)}>
						Open timeline
					</a>
				</div>
			</div>
		</div>
	</div>
</section>
