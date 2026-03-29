# Generation Orchestration

## Goal

Create a reliable generation pipeline that turns project inputs into queued, traceable, and retryable AI image jobs.

## MVP scope

- Job creation and lifecycle states
- Provider adapter built on the Vercel AI SDK with Ollama for local development and Google Gemini via Vercel AI Gateway for preview and production
- Credit reservation and deduction hooks
- Failure, retry, and result persistence behavior

## Requirements

- Each generation request has a durable job record.
- Output images and provider metadata are persisted for later review.
- The app can safely recover from provider or network failures.
- Billing and support teams can inspect what happened after a failed run.
- The same Vercel AI SDK abstraction can target local Ollama models in development and Google Gemini routes in hosted environments.

## Task breakdown

- Define job, result, and provider metadata schema ownership.
- Add a provider abstraction layer around the Vercel AI SDK, including environment-based routing between Ollama and Vercel AI Gateway.
- Implement create, queue, process, retry, and cancel behaviors.
- Persist revised prompts, aspect ratio, seed, and timing metadata when available.
- Add idempotency keys for generation submission and retry paths.
- Define the default production route for Google Gemini image generation and the local Ollama model contract used for development and smoke tests.
- Surface job status in the project detail UI.

## Acceptance criteria

- A submitted generation moves through queued, processing, and terminal states.
- Failed jobs capture inspectable error details.
- Successful jobs persist at least one generated image and related metadata.
- Development environments can run end-to-end generation tests against Ollama, while preview and production environments resolve through Google Gemini without code-path drift.

## Non-goals

- Multi-region worker fleet
- Fine-tuning custom models in v1
