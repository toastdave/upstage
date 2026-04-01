# Presets And Personalization

## Goal

Make Upstage feel opinionated and high-conviction by helping users start from tested visual directions instead of blank prompts.

## MVP scope

- Featured presets for room types and aesthetic directions
- Prompt templates with editable details
- Saved favorite presets
- Personal defaults for aspect ratio and workflow choices

## Requirements

- Presets speed up first generation time.
- Advanced users can still customize prompts without losing the guided structure.
- Preset quality can improve over time without rewriting the whole UI.
- Presets remain provider-agnostic product primitives even when the compiled prompts differ across Ollama and Gemini.

## Task breakdown

- Seed starter presets by workflow and style family.
- Build preset browser and preset application actions.
- Support editable prompt overlays on top of structured templates.
- Compile presets into provider-aware prompt variants so local Ollama and hosted Gemini can share the same product-level preset catalog.
- Add user-level favorite and recent preset tracking.
- Add internal evaluation notes for future preset tuning.

## Acceptance criteria

- Users can start a job from a preset instead of writing a prompt from scratch.
- Presets are grouped clearly by workflow or aesthetic category.
- Users can save favorite presets for later reuse.

## Initial implementation status

- Starter presets are seeded in the database and available in the project generation setup flow.
- Presets already compile into provider-aware prompts while keeping the product-facing preset catalog stable.

## Remaining follow-up

- Add preset browsing beyond the current select menu and expose richer preset descriptions/examples.
- Add favorites, recents, and user-level personalization on top of the current seeded catalog.

## Non-goals

- User-generated marketplace presets
- Fully automatic prompt optimization loops in v1
