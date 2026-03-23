# Upstage

Upstage is an AI image generation app for real estate staging, empty-room interior design, and redesigning existing spaces.

## Locked stack

- `SvelteKit` + `Svelte 5`
- `Tailwind CSS v4`
- `shadcn-svelte`
- `Drizzle ORM`
- `Postgres`
- `Better Auth`
- `Polar`
- `AI SDK` + `Vercel AI Gateway`
- `Bun workspaces`
- `Biome`
- `Docker Compose`
- `mise`

## Workspace layout

- `apps/web` - marketing site, auth, dashboard, and generation UI
- `apps/web/Dockerfile` - Bun SSR image for local dev and production-style builds
- `packages/db` - Drizzle schema, migrations, and seeding
- `docs/prds` - product and implementation planning docs

## Quick start

1. `cp .env.example .env`
2. `mise install`
3. `mise run install`
4. `mise run docker:up`
5. `mise run db:push`
6. `mise run seed`
7. `mise run dev`

To run the full app stack inside Docker with hot reloading, use `mise run dev:docker` and edit files locally.

## Auth setup

- Email/password auth uses `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- GitHub OAuth callback: `http://localhost:5173/api/auth/callback/github`
- Google OAuth callback: `http://localhost:5173/api/auth/callback/google`

## AI setup

- Default image generation routing uses `AI_GATEWAY_API_KEY`.
- Primary model is `google/gemini-3-pro-image`.
- Secondary routing is configured through `AI_FALLBACK_MODEL` for lower-cost retries later.

## Core commands

- `mise run dev` - run the SvelteKit app locally with Bun
- `mise run dev:docker` - run the full stack in Docker with hot reloading
- `mise run lint` - run Biome linting
- `mise run format` - format the repo with Biome
- `mise run check` - run Svelte and TypeScript checks
- `mise run test` - run Bun tests
- `mise run build` - produce the SSR build
- `mise run db:generate` - generate Drizzle migrations
- `mise run db:migrate` - apply migrations
- `mise run db:studio` - open Drizzle Studio

## Notes

- We are intentionally starting with a `SvelteKit` monolith plus a future background worker package if async generation volume requires it.
- `svelte-adapter-bun` is used for Bun-native SSR output.
- `Biome` replaces both Prettier and ESLint for the initial codebase.
- Credits are the recommended monetization primitive; pricing docs in `docs/prds` assume prepaid usage.
