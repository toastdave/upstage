# Galleries And Deliverables

## Goal

Turn generated assets into usable deliverables for listing packages, presentations, and client review.

## MVP scope

- Project galleries with source-to-output grouping
- Download flows for generated images
- Variant selection and favorite marking
- Basic export framing for listing-ready outputs

## Requirements

- Users can quickly find previous results.
- Downloaded files preserve the quality and metadata needed for normal marketing use.
- The gallery view remains usable on mobile and desktop.

## Task breakdown

- Build project gallery and job detail pages.
- Add download and copy-link actions for generated images.
- Let users favorite a preferred variant.
- Show source asset and output images together for review.
- Add empty, loading, success, and failure states for gallery surfaces.

## Acceptance criteria

- A user can open a project and browse all generated outputs.
- A user can download at least one generated image.
- Favorite state is persisted for preferred variants.

## Initial implementation status

- Project pages now show generation history and render saved output images inline with each job.
- Source images and output batches already live together in the project detail workflow, even though the dedicated comparison and deliverables UX is still minimal.

## Remaining follow-up

- Add explicit before-and-after comparison tools, download actions, and favorite state.
- Break generation history into a richer gallery layout with variant grouping and deliverable-focused controls.

## Non-goals

- PDF presentation builder in v1
- Branded share portals for clients
