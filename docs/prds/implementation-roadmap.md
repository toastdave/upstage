# Implementation Roadmap

## Phase 1 - Foundation

- Finalize repository conventions, environments, local containers, and CI entrypoints.
- Establish Drizzle schema ownership, seed data, and workspace task runners.
- Ship the public shell, auth flows, and starter account area.

## Phase 2 - Projects And Inputs

- Implement project creation, project list views, and source asset uploads.
- Add storage-backed image metadata, validation, and moderation status.
- Build mobile-friendly upload and project detail states.

## Phase 3 - Generation Core

- Launch provider adapter, generation job lifecycle, and project-level result persistence.
- Add workflow selector, presets, aspect ratio controls, and variant generation.
- Add gallery and before-and-after review surfaces.

## Phase 4 - Monetization And Safety

- Launch credits, plan entitlements, Polar checkout, and billing webhooks.
- Enforce server-side balance checks and credit deductions.
- Add moderation review, abuse handling, and policy-driven denials.

## Phase 5 - Polish And Growth

- Add analytics, audit trails, and operational runbooks.
- Add collaboration-ready project surfaces and sharing hooks.
- Improve exports, favorites, and preset personalization.

## Cross-cutting launch checklist

- Every core route works on mobile and desktop.
- Core actions have empty, loading, success, and error states.
- Credits, auth, storage, and webhook secrets are separated by environment.
- Generation failures are traceable from UI to provider request metadata.
- Billing and moderation workflows are operationally reviewable before launch.
