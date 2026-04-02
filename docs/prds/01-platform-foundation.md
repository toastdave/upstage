# Platform Foundation

## Goal

Create the technical and design foundation for a fast-moving SvelteKit monolith that can support AI generation, storage, auth, and usage-based billing without forcing an early microservice split.

## MVP scope

- Monorepo structure with `apps/web` and `packages/db`
- Bun-native SSR output, local Docker services, and mise task runners
- Environment handling, database schema ownership, and local seeding
- Shared design tokens, public shell, auth routes, and starter account area

## Requirements

- Local setup works from a fresh clone with documented commands.
- Core environments exist for local, preview, and production.
- Database changes are versioned and repeatable.
- The app shell is opinionated enough to guide future dashboard work.
- AI environment defaults support Ollama for local development and Google Gemini routes for preview and production.

## Task breakdown

- Lock workspace conventions, scripts, and package versions.
- Set up Biome, strict TypeScript checks, and baseline tests.
- Containerize Postgres, object storage, mail testing, and SSR app runtime.
- Add environment variables for auth, billing, storage, Vercel AI SDK configuration, Ollama local routing, and Google Gemini production routing.
- Build the initial SvelteKit shell with public, auth, and account routes.
- Seed baseline plans and starter generation presets.

## Acceptance criteria

- A new developer can start the app locally in under 15 minutes.
- The app builds with Bun SSR output.
- Schema, seeds, and local services run without manual patching.
- Local AI requests can be exercised against Ollama without requiring production model credentials.

## Initial implementation status

- Bun monorepo, SvelteKit shell, Better Auth, Drizzle, Docker Compose, and mise workflow are in place.
- Local infrastructure now includes Postgres, MinIO, Mailpit, and Ollama.
- Environment defaults and docs distinguish local Ollama routing from hosted Gemini routing.
- Internal health checks now cover the SSR app, database connectivity, storage access, billing configuration, and generation queue state behind authenticated operations endpoints.

## Remaining follow-up

- Add CI entrypoints and deployment-specific environment validation.
- Add a dedicated background worker package once generation latency or retry volume requires it.

## Non-goals

- Production infra provisioning
- Dedicated worker autoscaling on day one
