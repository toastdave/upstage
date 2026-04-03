<script lang="ts">
import { resolve } from '$app/paths'
import { aspectRatioOptions, estimateGenerationCredits, formatAspectRatio } from '$lib/generation'
import { formatBytes } from '$lib/projects'
import {
	type RoomBriefFieldDefinition,
	emptyRoomBrief,
	getRoomBriefFieldState,
	roomBriefFieldDefinitions,
} from '$lib/room-briefs'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

type ActionValues = {
	additionalInstructions?: string
	aspectRatio?: string
	generationImageId?: string
	generationJobId?: string
	presetId?: string
	sourceAssetId?: string
}

type ProjectAsset = PageData['activeAssets'][number]
type GeneratedJob = PageData['generationState']['jobs'][number]
type GeneratedImage = GeneratedJob['images'][number]
type MatchingPreset = PageData['generationState']['presets'][number]
type RoomBriefField = RoomBriefFieldDefinition

const actionValues = $derived(((form ?? {}) as { values?: ActionValues }).values)

const uploadDimensions = $state<Record<string, { height: string; width: string }>>({})
const selectedGalleryImageByJob = $state<Record<string, string>>({})
let copiedGalleryImageId = $state('')
let selectedAspectRatio = $state('')
let selectedPresetId = $state('')
let selectedSourceAssetId = $state('')
let additionalInstructions = $state('')

const matchingPresets = $derived(
	data.generationState.presets.filter(
		(preset: MatchingPreset) => preset.category === data.project.projectType
	)
)
const runtimeCapability = $derived(
	data.generationState.capabilities.find(
		(capability: (typeof data.generationState.capabilities)[number]) =>
			capability.route === data.generationState.generationRoute
	)
)
const estimatedCredits = $derived(estimateGenerationCredits(selectedAspectRatio || '4:3'))
const hasEnoughCredits = $derived(data.billing.creditBalance >= estimatedCredits)
const selectedPreset = $derived(
	matchingPresets.find((preset: MatchingPreset) => preset.id === selectedPresetId) ?? null
)
const selectedAsset = $derived(
	data.activeAssets.find((asset: ProjectAsset) => asset.id === selectedSourceAssetId) ??
		data.activeAssets[0] ??
		null
)
const selectedRoomBrief = $derived(selectedAsset?.roomBrief ?? emptyRoomBrief)
const selectedRoomBriefStatus = $derived(selectedAsset?.roomBriefStatus ?? 'missing')
const canGenerate = $derived(data.activeAssets.length > 0 && matchingPresets.length > 0)
const favoriteDeliverableCount = $derived(
	data.generationState.jobs.reduce(
		(count: number, job: GeneratedJob) =>
			count + job.images.filter((image: GeneratedImage) => image.isFavorite).length,
		0
	)
)
const favoritePresetCount = $derived(
	matchingPresets.filter((preset: MatchingPreset) => preset.isFavorite).length
)
const recentPresetIds = $derived(
	matchingPresets
		.filter((preset: MatchingPreset) => preset.lastUsedAt)
		.sort((left: MatchingPreset, right: MatchingPreset) => {
			if (!left.lastUsedAt || !right.lastUsedAt) {
				return 0
			}

			return new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime()
		})
		.slice(0, 3)
		.map((preset: MatchingPreset) => preset.id)
)

$effect(() => {
	if (
		!selectedSourceAssetId ||
		!data.activeAssets.some((asset: ProjectAsset) => asset.id === selectedSourceAssetId)
	) {
		selectedSourceAssetId = data.activeAssets[0]?.id ?? ''
	}

	if (
		!selectedPresetId ||
		!matchingPresets.some((preset: MatchingPreset) => preset.id === selectedPresetId)
	) {
		selectedPresetId = matchingPresets[0]?.id ?? ''
	}

	if (!aspectRatioOptions.some((option) => option.value === selectedAspectRatio)) {
		selectedAspectRatio =
			data.generationPreferences.defaultAspectRatio ??
			matchingPresets[0]?.defaultAspectRatio ??
			'4:3'
	}
})

$effect(() => {
	for (const job of data.generationState.jobs) {
		const preferredImage =
			job.images.find((image: GeneratedImage) => image.isFavorite) ?? job.images[0]

		if (!preferredImage) {
			continue
		}

		if (
			!selectedGalleryImageByJob[job.id] ||
			!job.images.some((image: GeneratedImage) => image.id === selectedGalleryImageByJob[job.id])
		) {
			selectedGalleryImageByJob[job.id] = preferredImage.id
		}
	}
})

$effect(() => {
	if (actionValues?.sourceAssetId) {
		selectedSourceAssetId = actionValues.sourceAssetId
	}

	if (actionValues?.presetId) {
		selectedPresetId = actionValues.presetId
	}

	if (form?.form === 'generateConcept' && actionValues) {
		selectedAspectRatio = actionValues.aspectRatio || selectedAspectRatio
		additionalInstructions = actionValues.additionalInstructions || ''
	}
})

async function handleFileChange(event: Event, key: string) {
	const input = event.currentTarget as HTMLInputElement
	const file = input.files?.[0]

	if (!file) {
		uploadDimensions[key] = { width: '', height: '' }
		return
	}

	const objectUrl = URL.createObjectURL(file)

	try {
		const dimensions = await new Promise<{ width: string; height: string }>((resolve) => {
			const image = new Image()

			image.onload = () => {
				resolve({
					height: String(image.naturalHeight),
					width: String(image.naturalWidth),
				})
			}

			image.onerror = () => {
				resolve({ height: '', width: '' })
			}

			image.src = objectUrl
		})

		uploadDimensions[key] = dimensions
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

function getRoomBriefMaxLength(field: RoomBriefField) {
	switch (field.key) {
		case 'roomType':
		case 'propertyType':
			return 80
		case 'styleDirection':
			return 200
		case 'notes':
		case 'requestedChanges':
			return 600
		default:
			return 400
	}
}

function getSelectedGalleryImage(job: GeneratedJob) {
	const selectedImageId = selectedGalleryImageByJob[job.id]

	return (
		job.images.find((image: GeneratedImage) => image.id === selectedImageId) ??
		job.images.find((image: GeneratedImage) => image.isFavorite) ??
		job.images[0] ??
		null
	)
}

function selectGalleryImage(jobId: string, imageId: string) {
	selectedGalleryImageByJob[jobId] = imageId
}

function buildDownloadUrl(path: string) {
	return `${path}?download=1`
}

function isRecentPreset(preset: MatchingPreset) {
	return recentPresetIds.includes(preset.id)
}

function getRetryAttempt(job: GeneratedJob) {
	return job.submission.retryAttempt ?? job.execution.retryAttempt ?? null
}

function getFailureCategory(job: GeneratedJob) {
	return job.failure?.category ?? null
}

function isRetryableFailure(job: GeneratedJob) {
	return job.failure?.retryable ?? true
}

function formatDuration(durationMs: number | null) {
	if (durationMs === null || durationMs < 0) {
		return null
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

function isActiveWorkerLease(job: GeneratedJob) {
	if (!job.execution.workerLeaseExpiresAt || job.execution.processingMode !== 'worker') {
		return false
	}

	return new Date(job.execution.workerLeaseExpiresAt).getTime() > Date.now()
}

function getProcessingModeLabel(job: GeneratedJob) {
	if (job.execution.processingMode === 'request') {
		return 'Processed inline with the request'
	}

	if (job.status === 'queued') {
		return 'Waiting for the deferred runner to claim this job'
	}

	if (job.execution.processingMode === 'worker') {
		return isActiveWorkerLease(job)
			? 'Claimed by the deferred runner with an active worker lease'
			: 'Processed through the deferred runner path'
	}

	return 'Processing route pending'
}

async function copyGalleryImageLink(imageId: string, path: string) {
	const url = new URL(path, window.location.origin).toString()
	await navigator.clipboard.writeText(url)
	copiedGalleryImageId = imageId
	window.setTimeout(() => {
		if (copiedGalleryImageId === imageId) {
			copiedGalleryImageId = ''
		}
	}, 1600)
}
</script>

<svelte:head>
	<title>{data.project.title} | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<button class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" type="button" onclick={() => window.location.assign(resolve('/account'))}>
			Back to workspace
		</button>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{data.project.projectTypeLabel}
		</span>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{runtimeCapability?.label ?? data.generationState.generationRoute}
		</span>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em]">
			{data.billing.creditBalance} credits available
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-moss-500">Project detail</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">{data.project.title}</h1>
				<p class="mt-4 max-w-2xl text-base leading-8 text-ink-700">
					Upload the clearest room photo you have, review the draft room brief, then generate a provider-aware concept from a cleaner plan.
				</p>

				<div class="mt-8 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
					{#if data.project.roomType}
						<span class="rounded-full bg-paper-100 px-3 py-1">{data.project.roomType}</span>
					{/if}
					{#if data.project.propertyType}
						<span class="rounded-full bg-paper-100 px-3 py-1">{data.project.propertyType}</span>
					{/if}
					{#if data.project.styleIntent}
						<span class="rounded-full bg-paper-100 px-3 py-1">{data.project.styleIntent}</span>
					{/if}
					{#if data.project.locationLabel}
						<span class="rounded-full bg-paper-100 px-3 py-1">{data.project.locationLabel}</span>
					{/if}
					<span class="rounded-full bg-paper-100 px-3 py-1">
						Created {new Date(data.project.createdAt).toLocaleDateString()}
					</span>
				</div>
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="upload-form">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Upload source photos</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Add the room angles you want to transform</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">
					Supported formats: {data.sourceUploadConstraints.allowedMimeTypes.join(', ')}. Max file size: {Math.round(data.sourceUploadConstraints.maxFileSizeBytes / (1024 * 1024))} MB.
				</p>

				<form class="mt-6 space-y-5" method="POST" action="?/uploadAsset" enctype="multipart/form-data">
					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="file">Room photo</label>
						<input accept="image/jpeg,image/png,image/webp" class="block w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 file:mr-4 file:rounded-full file:border-0 file:bg-ink-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-paper-100" id="file" name="file" required type="file" onchange={(event) => handleFileChange(event, 'new')} />
						<input name="width" type="hidden" value={uploadDimensions.new?.width ?? ''} />
						<input name="height" type="hidden" value={uploadDimensions.new?.height ?? ''} />
					</div>

					<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" type="submit">
						Upload source photo
					</button>
				</form>

				{#if form?.form === 'uploadAsset' && form.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if form?.form === 'uploadAsset' && form.error}
					<div class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-4 text-sm text-terracotta-500">
						<p>{form.error}</p>
						<a class="mt-3 inline-flex rounded-full border border-terracotta-500/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-500" href="#upload-form">
							Retry upload
						</a>
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="room-brief-form">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Room brief review</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Confirm the draft before generation</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">
					The first upload now prepares a draft room brief automatically. Review the inferred fields, keep the locked architecture constraints, and save the confirmed version you want generation to use.
				</p>

				{#if data.activeAssets.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						Upload a source photo first so Upstage can prepare a draft room brief.
					</div>
				{:else}
					<div class="mt-6 space-y-5">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="roomBriefAssetId">Source photo</label>
							<select bind:value={selectedSourceAssetId} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="roomBriefAssetId" name="roomBriefAssetId">
							{#each data.activeAssets as asset (asset.id)}
									<option value={asset.id}>{asset.originalFilename ?? 'Uploaded room photo'}{#if asset.width && asset.height} - {asset.width} x {asset.height}{/if}</option>
								{/each}
							</select>
						</div>

						<div class="rounded-[1.75rem] border border-ink-950/10 bg-paper-100/70 p-5 text-sm leading-7 text-ink-700">
							<div class="flex flex-wrap items-start justify-between gap-4">
								<div>
									<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Current draft</p>
									<p class="mt-2 text-base text-ink-950">{selectedAsset?.roomBriefSummary}</p>
								</div>
								<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
									{selectedRoomBriefStatus === 'reviewed' ? 'Reviewed' : 'Draft'}
								</span>
							</div>
						</div>

						{#key selectedSourceAssetId}
							<form class="space-y-5" method="POST" action="?/saveRoomBrief">
								<input name="sourceAssetId" type="hidden" value={selectedSourceAssetId} />

								<div class="grid gap-4 lg:grid-cols-2">
									{#each roomBriefFieldDefinitions as field (field.key)}
										<div class={field.rows > 2 ? 'space-y-2 lg:col-span-2' : 'space-y-2'}>
											<div class="flex items-center justify-between gap-3">
												<label class="text-sm font-medium text-ink-900" for={`brief-${field.key}`}>{field.label}</label>
												<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-ink-700">
													{getRoomBriefFieldState(field.key, selectedRoomBriefStatus)}
												</span>
											</div>

											{#if field.rows === 1}
												<input class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id={`brief-${field.key}`} maxlength={getRoomBriefMaxLength(field)} name={field.key} placeholder={field.placeholder} type="text" value={selectedRoomBrief[field.key]} />
											{:else}
												<textarea class="min-h-28 w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id={`brief-${field.key}`} maxlength={getRoomBriefMaxLength(field)} name={field.key} placeholder={field.placeholder} rows={field.rows}>{selectedRoomBrief[field.key]}</textarea>
											{/if}
										</div>
									{/each}
								</div>

								<div class="flex flex-wrap gap-3">
									<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100" type="submit">
										Save reviewed brief
									</button>
								</div>
							</form>
						{/key}

						<form method="POST" action="?/reanalyzeRoomBrief">
							<input name="sourceAssetId" type="hidden" value={selectedSourceAssetId} />
							<button class="rounded-full border border-ink-950/10 bg-white px-5 py-3 text-sm font-semibold text-ink-900" type="submit">
								Re-run room analysis
							</button>
						</form>
					</div>

					{#if (form?.form === 'saveRoomBrief' || form?.form === 'reanalyzeRoomBrief') && form.message}
						<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
							{form.message}
						</p>
					{/if}

					{#if (form?.form === 'saveRoomBrief' || form?.form === 'reanalyzeRoomBrief') && form.error}
						<div class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-4 text-sm text-terracotta-500">
							<p>{form.error}</p>
							<a class="mt-3 inline-flex rounded-full border border-terracotta-500/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-500" href="#room-brief-form">
								Retry review
							</a>
						</div>
					{/if}
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="generation-form">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Generation setup</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Generate from the reviewed room brief</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">
					The generation plan now starts from the saved room brief for the selected photo, then layers preset guidance, aspect ratio, and any run-specific notes on top.
				</p>

				{#if matchingPresets.length > 0}
					<div class="mt-6 rounded-[1.75rem] border border-ink-950/10 bg-paper-100/75 p-5">
						<div class="flex flex-wrap items-start justify-between gap-4">
							<div>
								<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Preset browser</p>
								<p class="mt-2 max-w-2xl text-sm leading-7 text-ink-700">
									Pin the looks you reuse most, keep recent directions close, and choose a tested visual starting point before each run.
								</p>
							</div>
							<div class="flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
								<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1">{matchingPresets.length} presets</span>
								<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1">{favoritePresetCount} favorites</span>
							</div>
						</div>

						<div class="mt-5 grid gap-3 lg:grid-cols-2">
							{#each matchingPresets as preset (preset.id)}
								<div class={`rounded-[1.5rem] border p-4 transition ${selectedPresetId === preset.id ? 'border-moss-500 bg-white shadow-[0_18px_48px_-30px_rgba(77,130,92,0.55)]' : 'border-ink-950/10 bg-white/80'}`}>
									<button class="w-full text-left" type="button" onclick={() => (selectedPresetId = preset.id)}>
										<div class="flex flex-wrap items-start justify-between gap-4">
											<div>
												<p class="font-semibold text-ink-950">{preset.name}</p>
												<p class="mt-2 text-sm leading-7 text-ink-700">{preset.promptTemplate}</p>
											</div>
											<span class="rounded-full border border-ink-950/10 bg-paper-100 px-3 py-1 text-xs uppercase tracking-[0.22em] text-ink-700">
												{formatAspectRatio(preset.defaultAspectRatio)}
											</span>
										</div>
									</button>

									<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
										<div class="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-ink-700/80">
											{#if preset.isFavorite}
												<span class="rounded-full bg-moss-500/12 px-3 py-1 text-moss-500">Favorite</span>
											{/if}
											{#if isRecentPreset(preset)}
												<span class="rounded-full bg-terracotta-500/12 px-3 py-1 text-terracotta-500">Recent</span>
											{/if}
											{#if preset.useCount > 0}
												<span class="rounded-full bg-paper-100 px-3 py-1">{preset.useCount} runs</span>
											{/if}
										</div>
										<form method="POST" action="?/togglePresetFavorite">
											<input name="presetId" type="hidden" value={preset.id} />
											<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="submit">
												{preset.isFavorite ? 'Unfavorite' : 'Save favorite'}
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>

						{#if form?.form === 'togglePresetFavorite' && form.message}
							<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
								{form.message}
							</p>
						{/if}

						{#if form?.form === 'togglePresetFavorite' && form.error}
							<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
								{form.error}
							</p>
						{/if}

						{#if selectedPreset}
							<div class="mt-5 rounded-2xl border border-ink-950/10 bg-white px-4 py-4 text-sm leading-7 text-ink-700">
								<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Selected preset</p>
								<p class="mt-2 font-semibold text-ink-950">{selectedPreset.name}</p>
								<p class="mt-2">{selectedPreset.promptTemplate}</p>
							</div>
						{/if}
					</div>
				{/if}

				<form class="mt-6 space-y-5" method="POST" action="?/generateConcept">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="sourceAssetId">Source photo</label>
							<select bind:value={selectedSourceAssetId} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="sourceAssetId" name="sourceAssetId" required>
								<option disabled value="">Choose a source photo</option>
								{#each data.activeAssets as asset (asset.id)}
									<option value={asset.id}>{asset.originalFilename ?? 'Uploaded room photo'}{#if asset.width && asset.height} - {asset.width} x {asset.height}{/if}</option>
								{/each}
							</select>
						</div>

						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="presetId">Preset</label>
							<select bind:value={selectedPresetId} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="presetId" name="presetId" required>
								<option disabled value="">Choose a preset</option>
								{#each matchingPresets as preset (preset.id)}
									<option value={preset.id}>{preset.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4 text-sm leading-7 text-ink-700">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Selected room brief</p>
								<p class="mt-2 text-ink-950">{selectedAsset?.roomBriefSummary ?? 'Choose a source photo to review its room brief.'}</p>
							</div>
							<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
								{selectedRoomBriefStatus === 'reviewed' ? 'Reviewed' : 'Draft'}
							</span>
						</div>
						{#if selectedRoomBriefStatus !== 'reviewed' && selectedAsset}
							<p class="mt-3 text-terracotta-500">
								This photo still uses a draft brief. You can generate now, but reviewing the brief usually produces tighter results.
							</p>
						{/if}
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="aspectRatio">Aspect ratio</label>
							<select bind:value={selectedAspectRatio} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="aspectRatio" name="aspectRatio" required>
								{#each aspectRatioOptions as option (option.value)}
									<option value={option.value}>{option.label} ({option.value})</option>
								{/each}
							</select>
						</div>

					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4">
						<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Estimated live cost</p>
						<p class="mt-2 font-display text-3xl text-ink-950">{estimatedCredits} credits</p>
						<p class="mt-2 text-sm leading-7 text-ink-700">Available balance: {data.billing.creditBalance} credits on the {data.billing.currentPlan.name} plan.</p>
					</div>
				</div>

					{#if !hasEnoughCredits}
						<p class="rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
							This run needs {estimatedCredits} credits, but only {data.billing.creditBalance} are available right now.
							{#if data.billing.polar.checkoutReady}
								<a class="ml-2 underline underline-offset-4" href={resolve('/account/billing/checkout')}>Top up in {data.billing.polar.environmentLabel.toLowerCase()}</a>
							{/if}
						</p>
					{/if}

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="additionalInstructions">Run-specific notes</label>
						<textarea bind:value={additionalInstructions} class="min-h-32 w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="additionalInstructions" maxlength="1200" name="additionalInstructions" placeholder="Example: Keep the balcony doors unobstructed, favor warm wood tones, and avoid adding a rug under the dining table."></textarea>
					</div>

					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4 text-sm leading-7 text-ink-700">
						<p class="font-semibold text-ink-950">Execution route</p>
						<p class="mt-2">{runtimeCapability?.description}</p>
						{#if runtimeCapability?.notes}
							<p class="mt-2 text-terracotta-500">{runtimeCapability.notes}</p>
						{/if}
					</div>

					<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100 disabled:opacity-60" disabled={!canGenerate || !hasEnoughCredits} type="submit">
						Generate concept
					</button>
				</form>

				{#if (form?.form === 'generateConcept' || form?.form === 'retryGeneration') && form.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if (form?.form === 'generateConcept' || form?.form === 'retryGeneration') && form.error}
					<div class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-4 text-sm text-terracotta-500">
						<p>{form.error}</p>
						<a class="mt-3 inline-flex rounded-full border border-terracotta-500/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-500" href="#generation-form">
							{form.form === 'retryGeneration' ? 'Retry failed run' : 'Retry generation'}
						</a>
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="gallery-review">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Gallery and deliverables</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Review before and after</h2>
						<p class="mt-3 max-w-3xl text-sm leading-7 text-ink-700">
							Compare each generated result against its source photo, mark favorites, and download the versions you want to keep.
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<a class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" href={resolve(`/account/projects/${data.project.slug}/gallery`)}>
							Open gallery library
						</a>
						<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
							{favoriteDeliverableCount} favorites
						</span>
					</div>
				</div>

				{#if form?.form === 'toggleFavorite' && form.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if form?.form === 'toggleFavorite' && form.error}
					<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{form.error}
					</p>
				{/if}

				{#if data.generationState.jobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No deliverables yet. Run a generation to unlock before-and-after review, downloads, and favorites.
					</div>
				{:else}
					<div class="mt-6 space-y-6">
						{#each data.generationState.jobs as job (job.id)}
							{@const selectedImage = getSelectedGalleryImage(job)}
							<div class="rounded-[1.75rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<div class="flex flex-wrap items-start justify-between gap-4">
									<div>
										<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{job.provider}</p>
										<h3 class="mt-2 font-display text-2xl text-ink-950">{job.styleLabel ?? 'Generated concept'}</h3>
										<p class="mt-2 text-sm text-ink-700">
											{job.sourceAsset?.originalFilename ?? 'Source photo'} - {formatAspectRatio(job.aspectRatio)}
										</p>
									</div>
								<div class="flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
									<span class="rounded-full bg-white px-3 py-1">{job.images.length} outputs</span>
									<span class="rounded-full bg-white px-3 py-1">Created {new Date(job.createdAt).toLocaleDateString()}</span>
									<a class="rounded-full bg-white px-3 py-1 hover:bg-paper-100" href={resolve(`/account/projects/${data.project.slug}/jobs/${job.id}`)}>
										Open batch
									</a>
									{#if job.images.some((image: GeneratedImage) => image.isFavorite)}
										<span class="rounded-full bg-moss-500/12 px-3 py-1 text-moss-500">Favorite saved</span>
									{/if}
									</div>
								</div>

								{#if selectedImage && job.sourceAsset}
									<div class="mt-5 grid gap-4 lg:grid-cols-2">
										<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-white">
											<div class="flex items-center justify-between border-b border-ink-950/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-ink-700">
												<span>Before</span>
												<span>{job.sourceAsset.originalFilename ?? 'Source photo'}</span>
											</div>
											<div class="aspect-[4/3] bg-ink-950/5">
												<img alt={job.sourceAsset.originalFilename ?? 'Source photo'} class="h-full w-full object-cover" src={job.sourceAsset.url} />
											</div>
										</div>

										<div class="overflow-hidden rounded-[1.5rem] border border-ink-950/10 bg-white">
											<div class="flex items-center justify-between border-b border-ink-950/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-ink-700">
												<span>After</span>
												<span>{selectedImage.isFavorite ? 'Favorite' : `Output ${selectedImage.sortOrder + 1}`}</span>
											</div>
											<div class="aspect-[4/3] bg-ink-950/5">
												<img alt={job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={selectedImage.url} />
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
													<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="button" onclick={() => copyGalleryImageLink(selectedImage.id, selectedImage.url)}>
														{copiedGalleryImageId === selectedImage.id ? 'Link copied' : 'Copy link'}
													</button>
												</div>
											</div>
										</div>
									</div>
								{/if}

								{#if job.images.length > 1}
									<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
										{#each job.images as image (image.id)}
											<button class={`overflow-hidden rounded-2xl border text-left transition ${selectedImage?.id === image.id ? 'border-moss-500 bg-white shadow-[0_18px_48px_-30px_rgba(77,130,92,0.6)]' : 'border-ink-950/10 bg-white hover:border-ink-950/30'}`} type="button" onclick={() => selectGalleryImage(job.id, image.id)}>
												<div class="aspect-[4/3] bg-ink-950/5">
													<img alt={job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={image.url} />
												</div>
												<div class="flex items-center justify-between gap-3 p-4 text-sm text-ink-700">
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
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Current source library</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Active room photos</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.activeAssets.length} active
					</span>
				</div>

				{#if data.activeAssets.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No active source photos yet. Upload the best room angle first, then add alternates if you want different staging options later.
					</div>
				{:else}
					<div class="mt-6 grid gap-5 lg:grid-cols-2">
						{#each data.activeAssets as asset (asset.id)}
							<div class="overflow-hidden rounded-[1.75rem] border border-ink-950/10 bg-paper-100/70">
								<div class="aspect-[4/3] bg-ink-950/5">
									<img alt={asset.originalFilename ?? data.project.title} class="h-full w-full object-cover" src={asset.url} />
								</div>
								<div class="space-y-4 p-5">
									<div class="flex items-start justify-between gap-4">
										<div>
											<p class="font-semibold text-ink-950">{asset.originalFilename ?? 'Uploaded room photo'}</p>
											<p class="mt-1 text-sm text-ink-700">{formatBytes(asset.fileSizeBytes)}{#if asset.width && asset.height} - {asset.width} x {asset.height}{/if}</p>
										</div>
										<div class="flex flex-col items-end gap-2">
											<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
												{asset.moderationStatus}
											</span>
											<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
												{asset.roomBriefStatus === 'reviewed' ? 'Reviewed brief' : 'Draft brief'}
											</span>
										</div>
									</div>

									<p class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm leading-7 text-ink-700">
										{asset.roomBriefSummary}
									</p>

									<form class="space-y-3" method="POST" action="?/replaceAsset" enctype="multipart/form-data">
										<input name="sourceAssetId" type="hidden" value={asset.id} />
										<input name="width" type="hidden" value={uploadDimensions[asset.id]?.width ?? ''} />
										<input name="height" type="hidden" value={uploadDimensions[asset.id]?.height ?? ''} />
										<label class="block text-sm font-medium text-ink-900" for={`replace-${asset.id}`}>Replace this photo</label>
										<input accept="image/jpeg,image/png,image/webp" class="block w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink-900" id={`replace-${asset.id}`} name="file" required type="file" onchange={(event) => handleFileChange(event, asset.id)} />
										<div class="flex flex-wrap gap-3">
											<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900" type="submit">
												Replace
											</button>
										</div>
									</form>

									<form method="POST" action="?/archiveAsset">
										<input name="sourceAssetId" type="hidden" value={asset.id} />
										<button class="rounded-full border border-terracotta-500/15 bg-terracotta-500/8 px-4 py-2 text-sm font-semibold text-terracotta-500" type="submit">
											Archive
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="job-timeline">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Generation history</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Job timeline</h2>
						<p class="mt-3 max-w-3xl text-sm leading-7 text-ink-700">
							Queued runs can be canceled until provider execution begins. Once a run moves into processing, the job stays traceable here with timing, credit diagnostics, and deferred-runner lease details.
						</p>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.generationState.jobs.length} jobs
					</span>
				</div>

				{#if form?.form === 'cancelGeneration' && form.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if form?.form === 'cancelGeneration' && form.error}
					<p class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{form.error}
					</p>
				{/if}

				{#if data.generationState.jobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No generation jobs yet. The first run will save its structured room brief, provider metadata, and output images here.
					</div>
				{:else}
					<div class="mt-6 space-y-5">
						{#each data.generationState.jobs as job (job.id)}
							{@const retryAttempt = getRetryAttempt(job)}
							{@const failureCategory = getFailureCategory(job)}
							{@const retryableFailure = isRetryableFailure(job)}
							{@const queueDuration = formatDuration(job.execution.queueDurationMs)}
							{@const runDuration = formatDuration(job.execution.runDurationMs)}
							{@const totalDuration = formatDuration(job.execution.totalDurationMs)}
							<div class="rounded-[1.75rem] border border-ink-950/10 bg-paper-100/70 p-5">
								<div class="flex flex-wrap items-start justify-between gap-4">
									<div>
										<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">{job.provider}</p>
										<h3 class="mt-2 font-display text-2xl text-ink-950">{job.styleLabel ?? 'Generated concept'}</h3>
										<p class="mt-2 text-sm text-ink-700">{formatAspectRatio(job.aspectRatio)} - {job.model}</p>
									</div>
									<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
										{job.status}
									</span>
								</div>

								<div class="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-ink-700/80">
									<span class="rounded-full bg-white px-3 py-1">Created {new Date(job.createdAt).toLocaleString()}</span>
									<span class="rounded-full bg-white px-3 py-1">Charge {job.creditCost} credits</span>
									{#if retryAttempt}
										<span class="rounded-full bg-white px-3 py-1">Attempt {retryAttempt}</span>
									{/if}
									{#if job.completedAt}
										<span class="rounded-full bg-white px-3 py-1">Completed {new Date(job.completedAt).toLocaleString()}</span>
									{/if}
									{#if job.execution.startedAt}
										<span class="rounded-full bg-white px-3 py-1">Started {new Date(job.execution.startedAt).toLocaleString()}</span>
									{/if}
									{#if failureCategory}
										<span class="rounded-full bg-terracotta-500/10 px-3 py-1 text-terracotta-500">{failureCategory}</span>
									{/if}
									{#if job.status === 'cancelled'}
										<span class="rounded-full bg-paper-100 px-3 py-1">Canceled before execution</span>
									{/if}
								</div>

								{#if job.errorMessage}
									<p class="mt-4 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
										{job.errorMessage}
									</p>
								{/if}

								<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
									<div class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-700">
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Submission</p>
										<p class="mt-2 text-ink-950">{job.submission.trigger === 'retry' ? 'Retry request' : 'Manual request'}</p>
										<p class="mt-1 text-xs text-ink-700/70">{job.sourceAsset?.originalFilename ?? 'Source photo selected'}</p>
									</div>
									<div class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-700">
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Queue time</p>
										<p class="mt-2 text-ink-950">{queueDuration ?? (job.status === 'queued' ? 'Waiting to start' : 'Not recorded')}</p>
										<p class="mt-1 text-xs text-ink-700/70">{getProcessingModeLabel(job)}</p>
									</div>
									<div class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-700">
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Run time</p>
										<p class="mt-2 text-ink-950">{runDuration ?? (job.status === 'processing' ? 'Running now' : 'Not recorded')}</p>
										<p class="mt-1 text-xs text-ink-700/70">Total lifecycle: {totalDuration ?? 'Not recorded'}</p>
									</div>
									<div class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-700">
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Worker lease</p>
										<p class="mt-2 text-ink-950">{job.execution.workerId ?? 'No worker claimed yet'}</p>
										<p class="mt-1 text-xs text-ink-700/70">
											{#if job.execution.lastHeartbeatAt}
												Heartbeat {new Date(job.execution.lastHeartbeatAt).toLocaleString()}
											{:else if job.status === 'queued'}
												Lease starts when the deferred runner claims this job.
											{:else}
												No heartbeat recorded for this run.
											{/if}
											{#if job.execution.workerLeaseExpiresAt}
												 - lease {isActiveWorkerLease(job) ? 'active' : 'expired'} until {new Date(job.execution.workerLeaseExpiresAt).toLocaleString()}
											{/if}
										</p>
									</div>
									<div class="rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-700">
										<p class="text-xs uppercase tracking-[0.22em] text-ink-700/60">Credit handling</p>
										<p class="mt-2 text-ink-950">Charged {job.billing.chargedCredits ?? job.creditCost} credits</p>
										<p class="mt-1 text-xs text-ink-700/70">{job.billing.refundedCredits ? `Refunded ${job.billing.refundedCredits} on failure or cancellation.` : 'No refund recorded for this run.'}</p>
									</div>
								</div>

								{#if job.status === 'failed'}
									<div class="mt-4 flex flex-wrap gap-3">
										<form method="POST" action="?/retryGeneration">
											<input name="generationJobId" type="hidden" value={job.id} />
											<button class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900 disabled:opacity-60" disabled={!retryableFailure} type="submit">
												Retry failed run
											</button>
										</form>
										{#if !retryableFailure}
											<p class="rounded-full border border-terracotta-500/15 bg-terracotta-500/8 px-4 py-2 text-sm text-terracotta-500">
												Fix the underlying issue before retrying this run.
											</p>
										{/if}
									</div>
								{/if}

								{#if job.canCancel}
									<div class="mt-4 flex flex-wrap gap-3">
										<form method="POST" action="?/cancelGeneration">
											<input name="generationJobId" type="hidden" value={job.id} />
											<button class="rounded-full border border-terracotta-500/15 bg-white px-4 py-2 text-sm font-semibold text-terracotta-500" type="submit">
												{job.status === 'processing' ? 'Cancel stalled run' : 'Cancel queued run'}
											</button>
										</form>
										<p class="rounded-full border border-ink-950/10 bg-white px-4 py-2 text-sm text-ink-700">
											{job.status === 'processing'
												? 'Expired worker leases can be interrupted safely and refunded.'
												: 'Credits restore automatically if the run has not started yet.'}
										</p>
									</div>
								{/if}

								{#if job.images.length > 0}
									<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
										{#each job.images as image (image.id)}
											<div class="overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
												<div class="aspect-[4/3] bg-ink-950/5">
													<img alt={job.styleLabel ?? 'Generated concept'} class="h-full w-full object-cover" src={image.url} />
												</div>
												<div class="p-4 text-sm text-ink-700">
													<p class="font-semibold text-ink-950">Output {image.sortOrder + 1}</p>
													<p class="mt-1">{image.mimeType}{#if image.width && image.height} - {image.width} x {image.height}{/if}</p>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-6">
			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Current AI route</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">{runtimeCapability?.label ?? 'Generation route'}</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">{runtimeCapability?.description}</p>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Structured room brief: {runtimeCapability?.supportsStructuredRoomBrief ? 'yes' : 'no'}</li>
					<li>Source-image editing: {runtimeCapability?.supportsSourceImageEditing ? 'yes' : 'no'}</li>
					<li>Explicit aspect ratio: {runtimeCapability?.supportsExplicitAspectRatio ? 'yes' : 'prompt hint only'}</li>
				</ul>
				{#if runtimeCapability?.notes}
					<p class="mt-4 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
						{runtimeCapability.notes}
					</p>
				{/if}
			</div>

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Phase 3 direction</p>
				<ul class="mt-5 space-y-3 text-sm leading-7 text-ink-700">
					<li>Uploads now create a draft room brief automatically for the selected photo.</li>
					<li>Reviewed briefs feed the generation plan before provider-specific prompt compilation.</li>
					<li>Every generation still stores enough metadata to support future reruns, critique loops, and provider swaps.</li>
				</ul>
			</div>

			{#if data.archivedAssets.length > 0}
				<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="text-sm uppercase tracking-[0.28em] text-ink-700/70">Archived</p>
							<h2 class="mt-3 font-display text-2xl text-ink-950">Previous source photos</h2>
						</div>
						<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
							{data.archivedAssets.length} archived
						</span>
					</div>

					<div class="mt-6 space-y-3">
						{#each data.archivedAssets as asset (asset.id)}
							<div class="rounded-2xl border border-ink-950/8 bg-paper-100/70 px-4 py-4 text-sm text-ink-700">
								<p class="font-semibold text-ink-950">{asset.originalFilename ?? 'Archived room photo'}</p>
								<p class="mt-1">Archived {asset.archivedAt ? new Date(asset.archivedAt).toLocaleDateString() : 'recently'} - {formatBytes(asset.fileSizeBytes)}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>
