<script lang="ts">
import { resolve } from '$app/paths'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

type GeneratedJob = PageData['generationState']['jobs'][number]
type GeneratedImage = GeneratedJob['images'][number]

let copiedImageId = $state('')

const sourceGroups = $derived.by(() => {
	const groups = new Map<
		string,
		{
			favoriteCount: number
			jobs: GeneratedJob[]
			sourceAsset: NonNullable<GeneratedJob['sourceAsset']>
		}
	>()

	for (const job of data.generationState.jobs) {
		if (!job.sourceAsset) {
			continue
		}

		const existing = groups.get(job.sourceAsset.id)

		if (existing) {
			existing.jobs.push(job)
			existing.favoriteCount += job.images.filter(
				(image: GeneratedImage) => image.isFavorite
			).length
			continue
		}

		groups.set(job.sourceAsset.id, {
			favoriteCount: job.images.filter((image: GeneratedImage) => image.isFavorite).length,
			jobs: [job],
			sourceAsset: job.sourceAsset,
		})
	}

	return Array.from(groups.values())
})

const galleryStats = $derived({
	favoriteCount: data.generationState.jobs.reduce(
		(total: number, job: GeneratedJob) =>
			total + job.images.filter((image: GeneratedImage) => image.isFavorite).length,
		0
	),
	outputCount: data.generationState.jobs.reduce(
		(total: number, job: GeneratedJob) => total + job.images.length,
		0
	),
	sourceCount: sourceGroups.length,
})

function buildDownloadUrl(path: string) {
	return `${path}?download=1`
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
</script>

<svelte:head>
	<title>{data.project.title} Gallery | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}`)}>
			Back to project
		</a>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{data.project.projectTypeLabel}
		</span>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{galleryStats.outputCount} outputs
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/78 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-terracotta-500">Project gallery</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">
					Browse deliverables by room photo and generation batch.
				</h1>
				<p class="mt-4 max-w-3xl text-base leading-8 text-ink-700">
					This library splits saved outputs away from the main workflow so you can scan source-photo groupings, jump into one batch, and keep favorite renders easy to find.
				</p>

				<div class="mt-8 grid gap-4 sm:grid-cols-3">
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Source photos</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{galleryStats.sourceCount}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Outputs</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{galleryStats.outputCount}</p>
					</div>
					<div class="rounded-2xl border border-ink-950/8 bg-paper-100/80 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Favorites</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{galleryStats.favoriteCount}</p>
					</div>
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

			{#if sourceGroups.length === 0}
				<div class="rounded-[2rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-8 text-sm leading-7 text-ink-700">
					No deliverables yet. Generate the first room concept from the project page to unlock the gallery library.
				</div>
			{:else}
				<div class="space-y-6">
					{#each sourceGroups as group (group.sourceAsset.id)}
						<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-6 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
							<div class="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
								<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-paper-100/75">
									<div class="aspect-[4/3] bg-ink-950/5">
										<img alt={group.sourceAsset.originalFilename ?? data.project.title} class="h-full w-full object-cover" src={group.sourceAsset.url} />
									</div>
									<div class="space-y-2 p-4 text-sm text-ink-700">
										<p class="font-semibold text-ink-950">{group.sourceAsset.originalFilename ?? 'Source photo'}</p>
										<p>{group.jobs.length} batch{group.jobs.length === 1 ? '' : 'es'} - {group.favoriteCount} favorite{group.favoriteCount === 1 ? '' : 's'}</p>
										<p>{group.sourceAsset.roomBriefSummary}</p>
									</div>
								</div>

								<div class="space-y-4">
									<div>
										<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Output batches</p>
										<h2 class="mt-3 font-display text-3xl text-ink-950">Review saved runs for this source photo</h2>
									</div>

									<div class="grid gap-4 sm:grid-cols-2">
										{#each group.jobs as job (job.id)}
											{@const heroImage = job.images.find((image) => image.isFavorite) ?? job.images[0]}
											<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-paper-100/75 transition hover:-translate-y-0.5 hover:border-ink-950/20 hover:bg-white">
												{#if heroImage}
													<div class="aspect-[4/3] bg-ink-950/5">
														<img alt={job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={heroImage.url} />
													</div>
												{/if}
												<div class="space-y-3 p-4 text-sm text-ink-700">
													<div class="flex items-start justify-between gap-4">
														<div>
															<p class="text-xs uppercase tracking-[0.22em] text-ink-700/70">{job.provider}</p>
															<p class="mt-2 font-semibold text-ink-950">{job.styleLabel ?? 'Generated concept'}</p>
														</div>
														<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-ink-700">
															{job.status}
														</span>
													</div>
													<p>{job.images.length} outputs - {new Date(job.createdAt).toLocaleDateString()}</p>
													{#if heroImage}
														<div class="flex flex-wrap gap-2">
															<button class="rounded-full border border-ink-950/10 bg-white px-3 py-2 text-xs font-semibold text-ink-900" type="button" onclick={(event) => {
																event.preventDefault()
																window.location.assign(buildDownloadUrl(heroImage.url))
															}}>
																Download hero
															</button>
															<a class="rounded-full border border-ink-950/10 bg-white px-3 py-2 text-xs font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}/jobs/${job.id}`)}>
																Open batch
															</a>
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Favorites rail</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Preferred deliverables</h2>
				{#if galleryStats.favoriteCount === 0}
					<p class="mt-4 text-sm leading-7 text-ink-700">
						No favorites yet. Mark the strongest output in each batch so shortlist review stays quick.
					</p>
				{:else}
					<div class="mt-6 space-y-4">
						{#each data.generationState.jobs as job (job.id)}
							{#each job.images.filter((image: GeneratedImage) => image.isFavorite) as image (image.id)}
								<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-paper-100/75">
									<div class="aspect-[4/3] bg-ink-950/5">
										<img alt={job.styleLabel ?? 'Favorite deliverable'} class="h-full w-full object-cover" src={image.url} />
									</div>
									<div class="space-y-3 p-4 text-sm text-ink-700">
										<p class="font-semibold text-ink-950">{job.styleLabel ?? 'Favorite deliverable'}</p>
										<p>{job.sourceAsset?.originalFilename ?? 'Source photo'} - output {image.sortOrder + 1}</p>
										<div class="flex flex-wrap gap-3">
											<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="button" onclick={() => window.location.assign(buildDownloadUrl(image.url))}>
												Download
											</button>
											<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="button" onclick={() => copyImageLink(image.id, image.url)}>
												{copiedImageId === image.id ? 'Link copied' : 'Copy link'}
											</button>
										</div>
									</div>
								</div>
							{/each}
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Next steps</p>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Jump into one batch to compare outputs and review job diagnostics in more detail.</li>
					<li>Use favorites to keep shortlist review clean before downloads or client presentation work.</li>
					<li>Return to the main project page when you need to upload a new source photo or start another run.</li>
				</ul>
			</div>
		</div>
	</div>
</section>
