# Projects And Uploads

## Goal

Let users create projects, upload room photos, and organize source assets in a way that supports reliable AI edits and repeat iterations.

## MVP scope

- Project creation for virtual staging, empty-room design, and redesign use cases
- Source image upload and metadata capture
- Asset moderation state and storage cleanup ownership
- Mobile-friendly upload flows for agents in the field

## Requirements

- Upload flows work on mobile and desktop.
- Asset metadata is stored server-side and tied to a project.
- Invalid file types and oversize uploads are rejected clearly.
- Source assets can support future before-and-after comparison surfaces.

## Task breakdown

- Build project creation UI and project list views.
- Add signed upload flow from SvelteKit server routes to object storage.
- Validate file type, size, and image count server-side.
- Persist image dimensions, file size, and moderation state.
- Add replace, retry, and archive flows for uploaded source assets.
- Document storage cleanup and orphaned asset handling.

## Acceptance criteria

- A signed-in user can create a project and upload at least one room image.
- Upload metadata is queryable alongside project records.
- Invalid uploads fail with clear, user-facing messaging.

## Non-goals

- Video uploads
- Full DAM-style media library features
