# Credits And Billing

## Goal

Monetize Upstage with prepaid credits and subscription tiers while protecting margin against model usage costs.

## MVP scope

- Free and paid plan definitions
- Credit ledger and credit balance visibility
- Polar checkout entrypoints and webhook ingestion
- Server-side enforcement of credit usage before generation

## Requirements

- Credits are the source of truth for paid generation actions.
- Users understand what a generation will cost before they run it.
- Billing state is durable and webhook replays are idempotent.

## Task breakdown

- Define free and paid plan entitlements in the plan model.
- Build pricing page, account billing page, and upgrade CTA placement.
- Add Polar checkout, portal, and webhook handling.
- Persist purchases, subscription state, and credit grants in the database.
- Deduct credits when jobs are accepted and restore them on failed runs where needed.
- Add admin-friendly audit traces for balance changes.

## Acceptance criteria

- A user can complete checkout and receive credits or upgraded entitlements.
- The app blocks generation when balance is insufficient.
- Credit ledger entries explain why a balance changed.

## Non-goals

- Postpaid metered invoicing
- Enterprise procurement workflows
