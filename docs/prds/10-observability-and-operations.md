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
- Add operational notes for migrations, seeds, storage setup, webhook replay, and switching generation providers between Ollama and Google Gemini.
- Add health checks for SSR app, Postgres, and object storage.

## Acceptance criteria

- Critical actions emit inspectable logs or analytics events.
- Billing and moderation changes are traceable.
- Launch docs include recovery notes for generation failures and webhook issues.
- Generation logs clearly identify whether a request ran through local Ollama or Google Gemini via Vercel AI Gateway.

## Non-goals

- Full data warehouse pipelines
- APM-heavy instrumentation before first launch
