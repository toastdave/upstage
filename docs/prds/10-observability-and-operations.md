# Observability And Operations

## Goal

Ensure the MVP can be operated, debugged, and improved after launch without guessing about provider failures, credit issues, or upload problems.

## MVP scope

- Structured logs and route-level error tracking
- Basic analytics for uploads, generations, conversions, and upgrades
- Audit trails for billing and moderation changes
- Runbooks for local setup, storage, webhook replay, and recovery

## Requirements

- The team can trace failures in auth, uploads, billing, and generation.
- Key funnel metrics are measurable from the start.
- Operators can replay or inspect billing and generation workflows safely.

## Task breakdown

- Define a shared event taxonomy for sign-up, upload, generate, download, and upgrade events.
- Add request logging and error boundaries.
- Persist billing and moderation audit events.
- Add operational notes for migrations, seeds, storage setup, webhook replay, local Ollama model pulls, and switching generation providers between Ollama and Gemini.
- Add health checks for SSR app, Postgres, and object storage.
- Add runtime diagnostics that explain whether a local generation request was unavailable due to host or model limitations.

## Acceptance criteria

- Critical actions emit inspectable logs or analytics events.
- Billing and moderation changes are traceable.
- Launch docs include recovery notes for generation failures and webhook issues.
- Generation logs clearly identify whether a request ran through local Ollama or Gemini via Vercel AI Gateway, plus any capability downgrade or unsupported-local-host message.

## Initial implementation status

- Generation jobs now persist provider route, request metadata, response metadata, and failure messages.
- Local infrastructure and README guidance already document Ollama setup and route selection.

## Remaining follow-up

- Add explicit structured logging, analytics events, and admin-friendly replay tooling.
- Add visibility into per-job latency, output counts, and provider capability downgrade reasons in the UI or internal tooling.

## Non-goals

- Full data warehouse pipelines
- APM-heavy instrumentation before first launch
