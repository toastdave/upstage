# Room Analysis And Edit Briefs

## Goal

Introduce a structured room-analysis layer that turns uploaded source photos into editable room briefs, giving Upstage a more reliable planning step before image generation.

## Why this exists

- The current generation flow already compiles a room brief JSON, but most of it still depends on user-entered form fields.
- We want local Ollama analysis to fill in room context for free during development while keeping the same product concepts usable with hosted Gemini generation.
- This layer should become the bridge between raw room photos and provider-specific prompts.

## MVP scope

- AI-assisted room analysis from a source image
- Structured room brief JSON that users can edit before generation
- Protected-elements capture for layout preservation
- Provider-aware prompt compilation from the room brief

## Requirements

- Analysis output must be structured, typed, and safe to edit in the UI.
- The room brief should help generation, not pretend to be perfect geometric truth.
- Users must be able to correct or override the AI-generated brief.
- The same room brief structure should work across local Ollama analysis and hosted generation routes.

## Recommended product defaults

- Automatically run room analysis after the first successful source-photo upload, then offer a manual re-analyze action from the project page.
- Present the brief in structured review sections backed by typed JSON rather than exposing a raw JSON editor in the MVP.
- Track field provenance so the UI can distinguish AI-inferred, user-confirmed, and locked protected-element fields.
- Keep the first pass focused on one analyzed source image and one generation submission path, then expand to richer variant flows after gallery UX is in place.
- Treat hosted Gemini generation as the production baseline while keeping Ollama analysis and generation support available for local development.

## Recommended brief structure

- Room type and probable property type
- Existing architectural anchors such as windows, doors, fireplace, trim, and built-ins
- Lighting conditions and key focal points
- Existing furniture inventory when relevant
- Protected elements the generator should preserve
- Requested transformation intent and style direction
- Negative constraints and realism guidance

## Task breakdown

- Define the room brief schema used by analysis and generation.
- Add a local analysis provider path backed by Ollama vision/text models.
- Add a project-page review step where users can confirm or edit the brief.
- Distinguish between inferred fields, user-confirmed fields, and locked protected elements.
- Compile the final brief into provider-specific generation instructions.
- Log which fields were AI-inferred versus user-edited for future prompt tuning.

## Acceptance criteria

- A user can ask Upstage to analyze a room photo and get back a structured room brief.
- The user can edit the brief before generating outputs.
- The first source-photo upload can populate a draft brief automatically, and the user can rerun analysis when needed.
- The review step makes inferred, confirmed, and locked fields visible before generation.
- The generation layer consumes the same room brief shape regardless of provider route.

## Relationship to other PRDs

- Depends on `03-projects-and-uploads.md` for source-photo ownership and storage
- Extends `04-generation-orchestration.md` with an analysis step before generation
- Extends `05-staging-and-design-workflows.md` with a more reliable prompt-planning surface
- Informs `10-observability-and-operations.md` because analysis quality and overrides should be traceable

## Non-goals

- Exact CAD-style room reconstruction
- Fully automatic scene graphs with perfect object coordinates
- Advanced masking or segmentation editors in the first pass
