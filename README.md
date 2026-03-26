# Upstage

Upstage is an AI image generation app for real estate staging, empty-room interior design, and redesigning existing spaces.

## Requirements

- `mise`
- `Docker` with `docker compose`
- `Tailscale` for tailnet access

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
- `AGENTS.md` and `.agents/` - agent-facing repo workflow guidance and references

## Getting started

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update `.env` for your machine:

```dotenv
BETTER_AUTH_URL=https://<device>.<tailnet>.ts.net:7412
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:7412,https://<device>.<tailnet>.ts.net:7412
```

3. Install the toolchain and dependencies:

```bash
mise install
mise run install
```

4. Choose a development workflow:

- `mise run dev` for the web app on your host machine with Docker-managed support services
- `mise run dev:docker` for the entire stack in Docker with hot reload

## Local development

Run the supporting services in Docker and the web app on your host machine.

Start:

```bash
mise run docker:up
mise run db:push
mise run seed
mise run dev
```

`mise run db:push` may prompt before applying schema changes. Accept the prompt, then run `mise run seed`.

App URLs:

- Web app: `http://localhost:7412`
- Mailpit: `http://localhost:8026`
- MinIO console: `http://localhost:9011`

Stop supporting services:

```bash
mise run docker:down
```

Reset local infrastructure data:

```bash
docker compose down -v
```

The app supports hot reload in this mode. Leave the Docker services running while you edit files locally.

## Full Docker development

Run the entire app stack inside Docker with hot reload.

Start:

```bash
mise run dev:docker
```

This task runs detached. Follow the app logs with:

```bash
docker compose logs -f web
```

In another shell, initialize the database if needed:

```bash
mise run db:push
mise run seed
```

`mise run db:push` may prompt before applying schema changes. Accept the prompt, then run `mise run seed`.

Open:

- Web app: `http://localhost:7412`
- Mailpit: `http://localhost:8026`
- MinIO console: `http://localhost:9011`

Stop:

```bash
mise run docker:down
```

Reset all Docker data:

```bash
docker compose down -v
```

The stack is safe to leave running during development. Code changes are picked up by the containerized Vite dev server.

## Tailscale access

Expose the web app to your tailnet after either local or full Docker development is running.

This repo uses its own dedicated app port so multiple projects can share one tailnet node without colliding on `443` or each other.

Start Tailscale Serve:

```bash
mise run tailscale:up
```

Check status:

```bash
mise run tailscale:status
```

Stop serving over Tailscale:

```bash
mise run tailscale:down
```

Open the app from another device on your tailnet:

```text
https://<device>.<tailnet>.ts.net:7412
```

Use the full `https://` URL. This setup serves HTTPS on port `7412`; `http://` requests to the tailnet hostname will fail.

## Auth setup

- Email/password auth uses `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- GitHub OAuth callback: `http://localhost:7412/api/auth/callback/github`
- Google OAuth callback: `http://localhost:7412/api/auth/callback/google`

## AI setup

- Default image generation routing uses `AI_GATEWAY_API_KEY`.
- Primary model is `google/gemini-3-pro-image`.
- Secondary routing is configured through `AI_FALLBACK_MODEL` for lower-cost retries later.

## Core commands

- `mise run dev` - run the SvelteKit app locally with Bun
- `mise run dev:docker` - run the full stack in Docker with hot reloading
- `mise run tailscale:up` - expose the app over Tailscale on port `7412`
- `mise run tailscale:status` - inspect Tailscale Serve status
- `mise run tailscale:down` - stop Tailscale Serve on port `7412`
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
- The dedicated local and tailnet app port is `7412` so it does not collide with sibling projects.
- `svelte-adapter-bun` is used for Bun-native SSR output.
- `Biome` replaces both Prettier and ESLint for the initial codebase.
- Credits are the recommended monetization primitive; pricing docs in `docs/prds` assume prepaid usage.
