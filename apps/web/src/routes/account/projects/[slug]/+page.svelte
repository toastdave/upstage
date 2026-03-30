<script lang="ts">
import { aspectRatioOptions, estimateGenerationCredits, formatAspectRatio } from '$lib/generation'
import { formatBytes } from '$lib/projects'
import type { ActionData, PageData } from './$types'

const { data, form } = $props<{ data: PageData; form?: ActionData }>()

const uploadDimensions = $state<Record<string, { height: string; width: string }>>({})
let selectedAspectRatio = $state('4:3')
let selectedPresetId = $state('')
let selectedSourceAssetId = $state('')
let protectedElements = $state('')
let additionalInstructions = $state('')

const matchingPresets = $derived(
	data.generationState.presets.filter(
		(preset: (typeof data.generationState.presets)[number]) =>
			preset.category === data.project.projectType
	)
)
const runtimeCapability = $derived(
	data.generationState.capabilities.find(
		(capability: (typeof data.generationState.capabilities)[number]) =>
			capability.route === data.generationState.generationRoute
	)
)
const estimatedCredits = $derived(estimateGenerationCredits(selectedAspectRatio))

$effect(() => {
	if (form?.form === 'generateConcept' && form.values) {
		selectedAspectRatio = form.values.aspectRatio || selectedAspectRatio
		selectedPresetId = form.values.presetId || selectedPresetId
		selectedSourceAssetId = form.values.sourceAssetId || selectedSourceAssetId
		protectedElements = form.values.protectedElements || ''
		additionalInstructions = form.values.additionalInstructions || ''
		return
	}

	selectedAspectRatio = matchingPresets[0]?.defaultAspectRatio ?? '4:3'
	selectedPresetId = matchingPresets[0]?.id ?? ''
	selectedSourceAssetId = data.activeAssets[0]?.id ?? ''
	protectedElements = 'Windows, doors, wall trim, layout, and permanent architectural features'
	additionalInstructions = ''
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
</script>

<svelte:head>
	<title>{data.project.title} | Upstage</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
	<div class="flex flex-wrap items-center gap-3 text-sm text-ink-700">
		<a class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 font-semibold text-ink-900" href="/account">
			Back to workspace
		</a>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 uppercase tracking-[0.24em] text-xs">
			{data.project.projectTypeLabel}
		</span>
		<span class="rounded-full border border-ink-950/10 bg-white/70 px-4 py-2 uppercase tracking-[0.24em] text-xs">
			{runtimeCapability?.label ?? data.generationState.generationRoute}
		</span>
	</div>

	<div class="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
		<div class="space-y-6">
			<div class="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_32px_120px_-48px_rgba(18,36,40,0.45)] backdrop-blur">
				<p class="font-display text-sm uppercase tracking-[0.3em] text-moss-500">Project detail</p>
				<h1 class="mt-4 font-display text-4xl leading-none text-ink-950 sm:text-5xl">{data.project.title}</h1>
				<p class="mt-4 max-w-2xl text-base leading-8 text-ink-700">
					Upload the clearest room photo you have, then turn it into a structured generation brief with presets, constraints, and provider-aware execution.
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

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur" id="generation-form">
				<p class="text-sm uppercase tracking-[0.28em] text-moss-500">Generation setup</p>
				<h2 class="mt-3 font-display text-3xl text-ink-950">Turn the room into an editable generation plan</h2>
				<p class="mt-3 text-sm leading-7 text-ink-700">
					The prompt compiler turns this form into a structured room brief JSON plus provider-specific prompt instructions. Local runs use Ollama, while production routes through Gemini.
				</p>

				<form class="mt-6 space-y-5" method="POST" action="?/generateConcept">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="sourceAssetId">Source photo</label>
							<select bind:value={selectedSourceAssetId} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="sourceAssetId" name="sourceAssetId" required>
								<option disabled value="">Choose a source photo</option>
								{#each data.activeAssets as asset}
									<option value={asset.id}>{asset.originalFilename ?? 'Uploaded room photo'}{#if asset.width && asset.height} - {asset.width} x {asset.height}{/if}</option>
								{/each}
							</select>
						</div>

						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="presetId">Preset</label>
							<select bind:value={selectedPresetId} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="presetId" name="presetId" required>
								<option disabled value="">Choose a preset</option>
								{#each matchingPresets as preset}
									<option value={preset.id}>{preset.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label class="text-sm font-medium text-ink-900" for="aspectRatio">Aspect ratio</label>
							<select bind:value={selectedAspectRatio} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="aspectRatio" name="aspectRatio" required>
								{#each aspectRatioOptions as option}
									<option value={option.value}>{option.label} ({option.value})</option>
								{/each}
							</select>
						</div>

						<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4">
							<p class="text-xs uppercase tracking-[0.24em] text-ink-700/70">Estimated live cost</p>
							<p class="mt-2 font-display text-3xl text-ink-950">{estimatedCredits} credits</p>
							<p class="mt-2 text-sm leading-7 text-ink-700">Credits remain a planning estimate until billing hooks are live.</p>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="protectedElements">Protected elements</label>
						<input bind:value={protectedElements} class="w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="protectedElements" maxlength="600" name="protectedElements" placeholder="Windows, fireplace, trim, built-ins, balcony doors..." type="text" />
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-ink-900" for="additionalInstructions">Transformation notes</label>
						<textarea bind:value={additionalInstructions} class="min-h-32 w-full rounded-2xl border border-ink-950/10 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-moss-500" id="additionalInstructions" maxlength="1200" name="additionalInstructions" placeholder="Example: Add an upscale but believable furniture package, keep the room airy, and avoid adding a rug under the dining table."></textarea>
					</div>

					<div class="rounded-2xl border border-ink-950/10 bg-paper-100/75 px-4 py-4 text-sm leading-7 text-ink-700">
						<p class="font-semibold text-ink-950">Execution route</p>
						<p class="mt-2">{runtimeCapability?.description}</p>
						{#if runtimeCapability?.notes}
							<p class="mt-2 text-terracotta-500">{runtimeCapability.notes}</p>
						{/if}
					</div>

					<button class="rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-paper-100 disabled:opacity-60" disabled={data.activeAssets.length === 0 || matchingPresets.length === 0} type="submit">
						Generate concept
					</button>
				</form>

				{#if form?.form === 'generateConcept' && form.message}
					<p class="mt-5 rounded-2xl border border-moss-500/20 bg-moss-500/10 px-4 py-3 text-sm text-moss-500">
						{form.message}
					</p>
				{/if}

				{#if form?.form === 'generateConcept' && form.error}
					<div class="mt-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-4 text-sm text-terracotta-500">
						<p>{form.error}</p>
						<a class="mt-3 inline-flex rounded-full border border-terracotta-500/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-500" href="#generation-form">
							Retry generation
						</a>
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
						{#each data.activeAssets as asset}
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
										<span class="rounded-full border border-ink-950/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-ink-700">
											{asset.moderationStatus}
										</span>
									</div>

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

			<div class="rounded-[2rem] border border-ink-950/10 bg-white/85 p-8 shadow-[0_24px_90px_-54px_rgba(18,36,40,0.55)] backdrop-blur">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-[0.28em] text-terracotta-500">Generation history</p>
						<h2 class="mt-3 font-display text-3xl text-ink-950">Job timeline</h2>
					</div>
					<span class="rounded-full border border-ink-950/10 bg-paper-100 px-4 py-2 text-xs uppercase tracking-[0.24em] text-ink-700">
						{data.generationState.jobs.length} jobs
					</span>
				</div>

				{#if data.generationState.jobs.length === 0}
					<div class="mt-6 rounded-[1.75rem] border border-dashed border-ink-950/15 bg-paper-100/75 p-6 text-sm leading-7 text-ink-700">
						No generation jobs yet. The first run will save its structured room brief, provider metadata, and output images here.
					</div>
				{:else}
					<div class="mt-6 space-y-5">
						{#each data.generationState.jobs as job}
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
									<span class="rounded-full bg-white px-3 py-1">Est. {job.creditCost} credits</span>
									{#if job.completedAt}
										<span class="rounded-full bg-white px-3 py-1">Completed {new Date(job.completedAt).toLocaleString()}</span>
									{/if}
								</div>

								{#if job.errorMessage}
									<p class="mt-4 rounded-2xl border border-terracotta-500/20 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-500">
										{job.errorMessage}
									</p>
								{/if}

								{#if job.images.length > 0}
									<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
										{#each job.images as image}
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
					<li>Local development uses a provider-aware route with Ollama and Flux-style prompting.</li>
					<li>Production runs through Gemini using the same internal generation plan structure.</li>
					<li>Every generation stores enough metadata to support future reruns, critique loops, and provider swaps.</li>
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
						{#each data.archivedAssets as asset}
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
