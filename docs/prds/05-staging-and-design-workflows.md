# Staging And Design Workflows

## Goal

Help users produce high-intent outputs for property marketing and design ideation, not just generic prompt-based images.

## MVP scope

- Workflow-specific prompts for staging, empty-room design, and redesign
- Style and room-type controls
- Aspect ratio choices aligned to listing and social outputs
- Before-and-after review surfaces
- Structured room brief JSON that captures protected elements and requested changes

## User stories

- As an agent, I can stage an empty room so buyers can imagine the finished space.
- As a designer, I can test multiple visual directions before presenting a concept.
- As a host, I can redesign a dated room for rental marketing without a real renovation.

## Task breakdown

- Design workflow selector and prompt-builder UI.
- Build style presets, room labels, and detail controls.
- Add workflow-aware prompt templates and provider input shaping that compile from a structured room brief and stay compatible across local Ollama development runs and Gemini production runs.
- Support generating multiple variants from a single source photo.
- Add basic before-and-after comparison view.
- Add guidance copy so users understand realistic inputs and expected outputs.
- Define how protected elements and requested changes map into provider-specific prompt instructions.

## Acceptance criteria

- Users can choose a workflow and style direction before generating.
- Generated results are grouped by project and job.
- The app clearly distinguishes staged, designed, and redesigned outputs.

## Initial implementation status

- Project detail pages now expose the first generation setup surface with source-photo selection, preset choice, aspect ratio, protected elements, and transformation notes.
- Generation requests compile into a room brief JSON plus a provider-specific prompt.

## Remaining follow-up

- Add AI-assisted image-to-JSON room analysis rather than relying only on user-entered constraints.
- Add before-and-after comparison UI and multi-variant selection.
- Add richer preset guidance and provider-aware prompt tuning.

## Non-goals

- Full manual masking tools
- CAD-accurate renovation planning
