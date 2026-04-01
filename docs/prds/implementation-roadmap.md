# Implementation Roadmap

## Phase 1 - Foundation

- Finalize repository conventions, environments, local containers, and CI entrypoints.
- Establish Drizzle schema ownership, seed data, and workspace task runners.
- Ship the public shell, auth flows, and starter account area.

## Phase 2 - Projects And Inputs

- Implement project creation, project list views, and source asset uploads.
- Add storage-backed image metadata, validation, and moderation status.
- Build mobile-friendly upload and project detail states.

Current status:

- Initial Phase 2 groundwork is in place: project creation, workspace list views, project detail pages, source-photo uploads, replacement, and archival.
- Remaining work is focused on direct signed uploads, mobile polish, and richer project detail workflows.

## Phase 3 - Generation Core

- Launch a Vercel AI SDK provider adapter, generation job lifecycle, and project-level result persistence.
- Support Ollama as the local development provider and Google Gemini via Vercel AI Gateway for preview and production.
- Add workflow selector, presets, aspect ratio controls, and variant generation.
- Add gallery and before-and-after review surfaces.

Current status:

- Initial generation setup, room brief compilation, provider routing, and job history are in place.
- Source-photo uploads now create a draft room brief automatically, project pages expose a structured review step, and reviewed briefs feed the generation planner.
- Project pages now expose a gallery-style before-and-after review surface with persisted favorites and download-ready generated images.
- Generation submissions now use deterministic idempotency keys, recent duplicate runs are deduplicated, and failed jobs can be retried safely from the project page.
- Remaining work is focused on background execution, cancellation, billing enforcement, richer output handling, and support-grade diagnostics.
- The next major slice should center on credits and billing enforcement, supported by deeper observability and async job processing.

Recommended next-build order:

1. Launch credits and billing enforcement before broader rollout.
2. Add async processing, cancellation rules, and stronger operational diagnostics.
3. Improve output handling with richer gallery and comparison flows.
4. Polish upload, mobile capture, and account surfaces after the core loop is durable.
5. Expand preset personalization and collaboration hooks once the core loop is monetized and stable.

Default product decisions for the next slice:

- Run room analysis automatically after the first successful source-photo upload, with an explicit re-analyze action.
- Review the room brief in structured UI sections backed by typed JSON rather than a raw JSON editor.
- Keep single-output generation acceptable for the first room-analysis slice; add richer variant flows after gallery UX lands.
- Treat Gemini as the hosted production-default provider while keeping Ollama as the local development route.
- Deduct or reserve credits when a job is accepted, then restore them with compensating ledger entries if the run fails before a usable result is saved.

## Phase 4 - Monetization And Safety

- Launch credits, plan entitlements, Polar checkout, and billing webhooks.
- Validate the full checkout-to-credit flow in Polar sandbox before enabling live billing.
- Enforce server-side balance checks and credit deductions.
- Add moderation review, abuse handling, and policy-driven denials.

Current status:

- Seeded plans now back real starter-credit grants, workspace pages show recent credit ledger activity, and project detail pages show live available balance.
- Generation acceptance now enforces insufficient-balance checks server-side, deducts credits when a run is accepted, and issues compensating refunds when execution fails.
- Remaining work is focused on Polar checkout and portal flows, webhook-backed fulfillment, and fuller billing/admin surfaces.

## Phase 5 - Polish And Growth

- Add analytics, audit trails, and operational runbooks.
- Add collaboration-ready project surfaces and sharing hooks.
- Improve exports, favorites, and preset personalization.

## Cross-cutting launch checklist

- Every core route works on mobile and desktop.
- Core actions have empty, loading, success, and error states.
- Credits, auth, storage, and webhook secrets are separated by environment.
- Billing environments are explicit: local app development, Polar sandbox, then live production.
- Generation failures are traceable from UI to provider request metadata.
- Local and hosted environments share one Vercel AI SDK integration path with provider routing differences isolated to configuration.
- Billing and moderation workflows are operationally reviewable before launch.
