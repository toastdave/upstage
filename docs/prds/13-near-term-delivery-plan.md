# Near-term Delivery Plan

## Goal

Turn the current foundation into a product-ready core loop by delivering guided room analysis, reviewable outputs, reliable orchestration, and enforceable billing in a clear sequence.

## Why this exists

- Upstage already has auth, projects, uploads, storage-backed assets, and durable generation job records.
- The biggest gap between the current app and the PRDs is the missing guided workflow between upload and generation.
- The next implementation slice should close product-risk first, then launch-risk.

## Current platform readout

- Foundation, auth, project creation, and source-photo management are working.
- Generation requests already persist durable jobs, provider metadata, and output images.
- The first room-brief slice is now in place: uploads create a draft brief, project pages allow structured review, and generation consumes the saved brief.
- The main remaining product layers are stronger provider-backed analysis quality, orchestration hardening, richer deliverable browsing, and full billing rollout maturity.

## Current recommendation

- With the first room-brief flow, gallery review surface, retry-safe submissions, and initial billing enforcement now shipped, the next engineering slice should focus on orchestration hardening.
- Prioritize moving generation execution off the request path, defining cancellation rules, and exposing support-facing diagnostics before investing further in richer gallery UX or deeper billing rollout work.
- This closes launch-risk across reliability, billing integrity, and support workflows while preserving the current guided product loop.

## Recommended defaults

- Run room analysis automatically after the first successful source-photo upload, with a manual re-analyze action available on the project page.
- Use a structured brief editor backed by typed JSON instead of exposing raw JSON in the MVP.
- Accept single-output generation in the next slice, then add richer variant batches after the gallery and review surfaces land.
- Use Gemini as the hosted production-default provider and keep Ollama as the local development route.
- Reserve or deduct credits when a job is accepted, then issue a compensating ledger entry if the run fails before a usable output is saved.

## Recommended delivery order

### 1. Room analysis and editable brief review

Why first:

- This is the clearest PRD priority and the highest-leverage product improvement.
- It turns Upstage from a prompt form into a guided workflow.

Scope:

- Define the durable room brief schema used by analysis and generation.
- Add analysis execution and persistence for the primary source photo.
- Show the draft brief on the project page with sectioned review and edit controls.
- Mark fields as inferred, confirmed, or locked where appropriate.
- Feed the reviewed brief into provider-specific prompt compilation.

Exit criteria:

- A new project with a source photo can produce a draft room brief.
- The brief is editable before generation.
- Generation uses the reviewed brief rather than only form-entered fields.

Current status:

- Initial delivery is shipped. Uploads create a stored draft brief, the project page exposes review and re-analysis actions, and the generation planner now uses the selected asset's saved brief.
- The remaining work in this tranche is mostly about improving analysis quality, provenance depth, and confidence before moving fully into gallery and deliverables work.

### 2. Gallery, comparison, and deliverables

Why next:

- Users need a deliverable-focused review surface, not only inline job history.
- This is the fastest follow-up to make generations feel useful and complete.

Scope:

- Add a gallery view grouped by job and source photo.
- Add before-and-after comparison, favorite state, and download actions.
- Preserve mobile usability and clear empty, loading, success, and failure states.

Exit criteria:

- A user can browse project outputs, compare source to result, favorite a preferred image, and download a deliverable.

Current status:

- Initial delivery is shipped. Project pages now include a gallery-style before-and-after review surface, persisted favorite toggles, download actions, and copy-link controls for generated images.
- The remaining work in this tranche is to split the gallery into richer library and job-detail views, improve export framing, and scale the browsing UX for larger output sets.

### 3. Orchestration hardening

Why next:

- The current pipeline is durable but not yet resilient enough for launch.
- Billing and support depend on reliable retries, traceability, and idempotency.

Scope:

- Move generation processing off the request path when needed.
- Implement true idempotency for submission and retry paths.
- Add retry handling, cancellation rules, and better failure diagnostics.
- Make job status transitions operationally inspectable.

Exit criteria:

- Duplicate submissions do not create accidental extra jobs.
- Failed jobs can be retried safely.
- Job state and provider failure details are traceable without reading raw logs.

Current status:

- Initial hardening is shipped. Generation submissions now use deterministic idempotency keys, recent duplicate runs are deduplicated, failed jobs can be retried safely from the project page, and billing hooks now issue compensating refunds on failed runs.
- Failure metadata now records retry eligibility and coarse failure categories in job history.
- Project pages now expose queue-time, run-time, total lifecycle, and refund diagnostics directly in the job timeline.
- Queued runs can now be canceled before provider execution starts, with automatic credit restoration when cancellation succeeds.
- The remaining work in this tranche is to move execution fully off the request path and carry the new cancellation and diagnostics model into async workers.
- This is now the recommended next implementation focus before expanding gallery complexity or production billing scope.

### 4. Credits and billing enforcement

Why next:

- Monetization is mostly schema-ready today.
- Launching billing before orchestration is trustworthy would create support and margin risk.

Scope:

- Build pricing and account billing surfaces.
- Add Polar checkout, portal access, and webhook ingestion.
- Persist credit ledger entries for grants, reservations, deductions, refunds, and manual adjustments.
- Enforce insufficient-balance checks before accepting generation jobs.

Exit criteria:

- Checkout can be validated in Polar sandbox end to end.
- Generation is blocked when balance is insufficient.
- Every balance change is explainable from the ledger.

Current status:

- Initial enforcement is shipped. Users now receive the seeded free plan and starter credits automatically, project pages show live credit balance, and the server blocks insufficient-balance generations before provider execution starts.
- Generation acceptance now records signed ledger entries, and failed jobs create compensating refund entries so balance changes remain traceable from the workspace.
- Queued generation cancellations now restore credits through the same traceable refund path before provider execution begins.
- Polar sandbox checkout and portal handoff routes are now wired, and webhook intake is in place so the hosted billing flow can be tested end to end once sandbox keys are added.
- A dedicated billing page now surfaces credit history, sandbox readiness, webhook endpoint guidance, and recent user-scoped Polar event audit entries.
- The remaining work in this tranche is deeper webhook fulfillment for renewals and refunds, richer pricing UX, and production-readiness validation after sandbox testing.

### 5. Upload and account polish

Why after the core loop:

- These improvements matter, but they compound best once the main generation flow is trustworthy.

Scope:

- Add direct signed uploads and multi-file upload UX.
- Improve mobile capture and project detail states.
- Add account settings, billing summary, and profile polish.

Exit criteria:

- Upload flows feel fast on mobile and desktop.
- Users can manage profile and billing state without leaving the workspace.

## Explicitly deferred until later

- Advanced masking or segmentation tools
- Multi-variant batch generation as the default flow
- Share portals and collaboration features
- Enterprise billing or postpaid metering

## Relationship to other PRDs

- Builds on `03-projects-and-uploads.md`
- Prioritizes `12-room-analysis-and-edit-briefs.md` and `06-galleries-and-deliverables.md`
- Sequences `04-generation-orchestration.md` ahead of `07-credits-and-billing.md`
- Leaves `11-growth-and-collaboration.md` for a later phase once the core loop is stable
