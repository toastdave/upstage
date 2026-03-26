# AGENTS.md

## Overview
Upstage is an AI-generated photo app for virtual staging, empty-room interior design, and redesigning existing spaces.
Build polished user-facing product experiences only; do not expose internal scaffolding, prompts, provider internals, or implementation details in the UI.
Use `docs/prds` for product requirements and `.agents/` for agent references, local workflow guidance, and external implementation links.

## Stack
- Bun workspaces
- SvelteKit 2 + Svelte 5
- Tailwind CSS v4 + shadcn-svelte for UI
- Better Auth for authentication
- Drizzle ORM + PostgreSQL
- AI SDK + Vercel AI Gateway for model access
- Docker Compose for local infrastructure
- mise for developer tasks
- Biome for formatting and linting
