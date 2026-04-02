# Generation Orchestration

## Goal

Create a reliable generation pipeline that turns project inputs into queued, traceable, and retryable AI image jobs.

## MVP scope

- Job creation and lifecycle states
- Capability-based provider adapter with local Ollama routing and Gemini via Vercel AI Gateway for hosted environments
- Credit reservation and deduction hooks
- Failure, retry, and result persistence behavior
- Structured room brief JSON that can be compiled into provider-specific generation requests

## Requirements

- Each generation request has a durable job record.
- Output images and provider metadata are persisted for later review.
- The app can safely recover from provider or network failures.
- Billing and support teams can inspect what happened after a failed run.
- The same orchestration layer can target local Ollama models in development and Gemini routes in hosted environments.
- Provider capability differences are explicit, especially around source-image editing, aspect-ratio control, and local hardware support.

## Task breakdown

- Define job, result, and provider metadata schema ownership.
- Add a capability-based provider abstraction layer with separate generation and analysis responsibilities.
- Route local generation to Ollama with a Flux-style image model and hosted generation to Gemini through Vercel AI Gateway.
- Implement create, queue, process, retry, and cancel behaviors.
- Persist revised prompts, aspect ratio, seed, and timing metadata when available.
- Add idempotency keys for generation submission and retry paths.
- Define the local Ollama contract, including the cases where image generation may be disabled or degraded on unsupported hosts.
- Define the default hosted route for Gemini image generation and the conditions for future Flux or other open-source hosted swaps.
- Surface job status in the project detail UI.

## Acceptance criteria

- A submitted generation moves through queued, processing, and terminal states.
- Failed jobs capture inspectable error details.
- Successful jobs persist at least one generated image and related metadata.
- Development environments can run end-to-end generation tests against Ollama when local image generation is available, while hosted environments resolve through Gemini without code-path drift in the orchestration layer.

## Initial implementation status

- Project detail pages now compile a structured room brief JSON and persist durable generation job records.
- Local routes target Ollama, while hosted routes are prepared for Gemini through Vercel AI Gateway.
- Job history now stores provider route, request metadata, response metadata, and generated image records.
- Submission keys are now deterministic per generation plan, which prevents accidental duplicate jobs for repeated requests and concurrent form submissions.
- Failed jobs can now be retried safely from the project detail page, with attempt metadata and failure classification persisted alongside each run.
- Jobs now record queue, run, and total lifecycle timing so support diagnostics are visible from the project detail page without reading raw logs.
- Queued jobs can now be canceled before provider execution begins, with compensating credit refunds recorded automatically when a queued run is withdrawn.
- The orchestration layer now supports deferred processing mode plus an internal token-protected job-runner endpoint, so queued jobs can be claimed outside the request path while preserving the original provider route and stored job metadata.
- Deferred worker claims now write lease and heartbeat metadata into job history, making runner ownership and liveness visible while a queued job is processing.
- Expired worker leases can now be reclaimed safely, and stale workers no longer own the final write path once a job has been reassigned or interrupted.

## Remaining follow-up

- This is still the recommended next engineering slice now that room-brief review, gallery review, retry-safe submissions, and initial credit enforcement are in place.
- Move from the current internal runner endpoint to a dedicated background worker package when latency or retry volume grows.
- Expand the current cancellation and diagnostic foundation into richer worker orchestration, including dedicated leasing storage, operator tools, and explicit in-flight interruption behavior once execution is fully detached.
- Harden credit reservation and compensating ledger behavior for async execution once billing enforcement is live.
- Add provider-aware critique and rerank passes for future quality control.

## Non-goals

- Multi-region worker fleet
- Fine-tuning custom models in v1
