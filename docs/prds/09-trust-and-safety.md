# Trust And Safety

## Goal

Protect Upstage from misuse, copyright headaches, and unsafe image generations without making the core workflow feel punitive.

## MVP scope

- Basic moderation state on uploads and outputs
- Admin review primitives and audit fields
- Policy copy for acceptable use and attribution expectations
- Rate limiting and abuse detection hooks

## Requirements

- Unsafe or obviously disallowed content can be blocked or flagged.
- Operators can inspect what happened on reported jobs.
- The product sets clear expectations about editing realism and misuse boundaries.

## Task breakdown

- Add moderation states to source assets and generated images.
- Define admin review workflows and reason codes.
- Add upload and generation guardrails for disallowed content categories.
- Log abuse-related events and generation denials.
- Document acceptable use for listing and design workflows.

## Acceptance criteria

- Operators can flag or block suspicious assets.
- The app stores review reasons and timestamps.
- Users see clear guidance when content is rejected.

## Non-goals

- Advanced CV-based content classification pipeline
- Legal review automation
