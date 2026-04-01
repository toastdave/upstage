# Credits And Billing

## Goal

Monetize Upstage with prepaid credits and subscription tiers while protecting margin against model usage costs.

## MVP scope

- Free and paid plan definitions
- Credit ledger and credit balance visibility
- Polar checkout entrypoints and webhook ingestion
- Polar sandbox validation before live billing is enabled
- Server-side enforcement of credit usage before generation

## Requirements

- Credits are the source of truth for paid generation actions.
- Users understand what a generation will cost before they run it.
- Billing state is durable and webhook replays are idempotent.
- Local development, Polar sandbox, and live production billing are treated as distinct environments.

## Task breakdown

- Define free and paid plan entitlements in the plan model.
- Build pricing page, account billing page, and upgrade CTA placement.
- Add Polar checkout, portal, and webhook handling.
- Validate checkout, webhook replay, and credit fulfillment in Polar sandbox before enabling live billing.
- Persist purchases, subscription state, and credit grants in the database.
- Deduct credits when jobs are accepted and restore them on failed runs where needed.
- Add admin-friendly audit traces for balance changes.

## Acceptance criteria

- A user can complete checkout and receive credits or upgraded entitlements.
- The same purchase-to-fulfillment flow can be verified in Polar sandbox without real money moving.
- The app blocks generation when balance is insufficient.
- Credit ledger entries explain why a balance changed.

## Initial implementation status

- Users now receive the seeded free plan automatically when billing state is first loaded.
- The app now grants starter credits from the active plan, shows recent ledger activity in the workspace, and exposes live credit balance on project detail pages.
- Generation acceptance now deducts credits immediately, failed runs issue compensating refunds, and insufficient-balance runs are blocked server-side before execution begins.

## Remaining follow-up

- Build pricing, checkout, and billing-portal entrypoints with Polar.
- Add webhook ingestion and replay-safe fulfillment for purchases and subscription changes.
- Expand ledger visibility into a dedicated billing page with admin-friendly audit traces.
- Add stronger concurrency protections around balance reservation once generation moves to async workers.

## Non-goals

- Postpaid metered invoicing
- Enterprise procurement workflows
