# Agent References

## Product
- `docs/prds/*`
- `docs/prds/implementation-roadmap.md`

## Runtime And Tooling
- Canonical docs: `https://bun.com/docs`
- Repo workflow sources: `README.md`, `mise.toml`, `compose.yaml`

## Auth
- Canonical docs: `https://www.better-auth.com/docs`
- LLM docs: `https://www.better-auth.com/llms.txt`
- Key repo files: `apps/web/src/lib/server/auth.ts`, `apps/web/src/lib/server/auth-providers.ts`

## AI And Models
- Canonical docs: `https://sdk.vercel.ai/docs`
- Gateway docs: `https://vercel.com/docs/ai-gateway`
- OpenAI-compatible responses docs: `https://vercel.com/docs/ai-gateway/sdks-and-apis/responses`
- Product-specific note: prefer `google/gemini-3-pro-image` as the primary model route unless PRDs say otherwise

## UI And Svelte
- Canonical docs: `https://www.shadcn-svelte.com/llms.txt`
- Registry and CLI: `https://www.shadcn-svelte.com/docs/cli`
- Supporting docs: `https://svelte.dev/docs`
- Policy: prefer shadcn-svelte primitives before building custom UI

## Database
- Canonical docs: `https://orm.drizzle.team/llms.txt`
- Supporting docs: `https://www.postgresql.org/docs/current/`
- Key repo files: `packages/db/src/schema/index.ts`, `packages/db/drizzle.config.ts`

## Docker And Local Development
- Repo sources: `README.md`, `mise.toml`, `compose.yaml`, `apps/web/Dockerfile`
- Policy: support both host-run app development and full Docker hot-reload workflows

## Tailscale
- CLI docs: `https://tailscale.com/kb/1241/tailscale-serve`
- Repo workflow sources: `README.md`, `mise.toml`, `.env.example`

## Git
- Follow conventional commits already used in this repo

## Browser Verification
- Use the running local app, Docker logs, and HTTP checks for workflow validation when possible
