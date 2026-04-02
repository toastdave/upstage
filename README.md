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
- `Ollama` for local AI routing
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
BETTER_AUTH_URL=https://<device>.<tailnet>.ts.net:1201
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:1201,https://<device>.<tailnet>.ts.net:1201
```

3. Install the toolchain and dependencies:

```bash
mise install
mise run install
```

4. Choose a development workflow:

- `mise run dev` for the web app on your host machine with Docker-managed support services
- `mise run dev:docker` for the entire stack in Docker with hot reload

Optional local AI model setup:

```bash
mise run ai:pull:analysis
mise run ai:pull:image
```

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

- Web app: `http://localhost:1201`
- Mailpit: `http://localhost:1204`
- MinIO console: `http://localhost:1206`
- Ollama API: `http://localhost:1207`

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

- Web app: `http://localhost:1201`
- Mailpit: `http://localhost:1204`
- MinIO console: `http://localhost:1206`
- Ollama API: `http://localhost:1207`

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
https://<device>.<tailnet>.ts.net:1201
```

Use the full `https://` URL. This setup serves HTTPS on port `1201`; `http://` requests to the tailnet hostname will fail.

## Auth setup

- Email/password auth uses `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- GitHub OAuth callback: `http://localhost:1201/api/auth/callback/github`
- Google OAuth callback: `http://localhost:1201/api/auth/callback/google`

## AI setup

- Local development defaults to `AI_EXECUTION_MODE=local`, which routes generation through Ollama.
- Hosted environments should set `AI_EXECUTION_MODE=production`, which routes generation through Gemini via AI Gateway.
- `AI_GENERATION_PROCESSING_MODE=inline` keeps generation on the request path; set it to `deferred` to leave jobs queued for the internal runner endpoint.
- `AI_JOB_RUNNER_TOKEN` secures the internal queued-job runner endpoint when deferred processing is enabled.
- `AI_LOCAL_ANALYSIS_MODEL` defaults to `gemma3`.
- `AI_LOCAL_IMAGE_MODEL` defaults to `x/flux2-klein:4b`.
- `AI_PRIMARY_MODEL` defaults to `google/gemini-3-pro-image-preview`.
- `AI_FALLBACK_MODEL` can define a lower-cost hosted fallback such as `google/gemini-2.5-flash-image`.
- Some Ollama image models have host-platform limits. If local image generation is unavailable, the app records a clear job failure and you can temporarily switch to hosted routing.

Queued generation runner endpoint:

- `POST /api/internal/generation-jobs/process`
- Send `Authorization: Bearer $AI_JOB_RUNNER_TOKEN`
- Optional JSON body: `{"jobId":"<job-id>"}` to process one job or `{"limit":5}` to drain several queued jobs in order

## Billing setup

- `POLAR_ACCESS_TOKEN` is used for Polar API access.
- `POLAR_WEBHOOK_SECRET` validates webhook deliveries.
- `POLAR_SERVER` should stay on `sandbox` until the full billing flow is verified end-to-end.
- `POLAR_PRO_PRODUCT_ID` should point at the Pro subscription product in your Polar sandbox organization.

Sandbox routes wired in the app:

- Checkout handoff: `/account/billing/checkout`
- Customer portal handoff: `/account/billing/portal`
- Webhook endpoint: `/api/webhooks/polar`

## Billing environments

- Local app development: use seeded plans, starter credits, or repo-specific billing stubs for UI and ledger work.
- Polar sandbox: use `https://sandbox.polar.sh/start` for fake-money checkout and `https://sandbox-api.polar.sh` for API calls.
- Production Polar: enable only after sandbox checkout, webhook replay handling, and credit fulfillment are all verified.

Sandbox notes:

- Polar sandbox is a separate environment, not a test-mode toggle on production data.
- Sandbox needs its own account, organization, and tokens.
- Stripe test cards work in Polar sandbox, for example `4242 4242 4242 4242` with a future expiry and any CVC.
- Configure the webhook endpoint in Polar to hit `https://<your-host>/api/webhooks/polar` using your sandbox webhook secret.
- The app uses the Upstage user ID as Polar `external_customer_id`, so checkout, portal, and customer-state sync all stay tied to the same local account.

## Core commands

- `mise run dev` - run the SvelteKit app locally with Bun
- `mise run dev:docker` - run the full stack in Docker with hot reloading
- `mise run ai:pull:analysis` - pull the local Ollama analysis model
- `mise run ai:pull:image` - pull the local Ollama image model
- `mise run ai:logs` - follow Ollama logs
- `mise run tailscale:up` - expose the app over Tailscale on port `1201`
- `mise run tailscale:status` - inspect Tailscale Serve status
- `mise run tailscale:down` - stop Tailscale Serve on port `1201`
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
- The dedicated local and tailnet app port is `1201` so it follows the project `12xx` port block and does not collide with sibling projects.
- `svelte-adapter-bun` is used for Bun-native SSR output.
- `Biome` replaces both Prettier and ESLint for the initial codebase.
- Credits are the recommended monetization primitive; pricing docs in `docs/prds` assume prepaid usage.
- Local generation is designed for workflow development first; hosted Gemini remains the higher-confidence production route.
