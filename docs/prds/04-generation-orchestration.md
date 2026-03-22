# Generation Orchestration

## Goal

Create a reliable generation pipeline that turns project inputs into queued, traceable, and retryable AI image jobs.

## MVP scope

- Job creation and lifecycle states
- Provider adapter for Nano Banana Pro via AI Gateway
- Credit reservation and deduction hooks
- Failure, retry, and result persistence behavior

## Requirements

- Each generation request has a durable job record.
- Output images and provider metadata are persisted for later review.
- The app can safely recover from provider or network failures.
- Billing and support teams can inspect what happened after a failed run.

## Task breakdown

- Define job, result, and provider metadata schema ownership.
- Add a provider abstraction layer around AI SDK + AI Gateway.
- Implement create, queue, process, retry, and cancel behaviors.
- Persist revised prompts, aspect ratio, seed, and timing metadata when available.
- Add idempotency keys for generation submission and retry paths.
- Surface job status in the project detail UI.

## Acceptance criteria

- A submitted generation moves through queued, processing, and terminal states.
- Failed jobs capture inspectable error details.
- Successful jobs persist at least one generated image and related metadata.

## Non-goals

- Multi-region worker fleet
- Fine-tuning custom models in v1
