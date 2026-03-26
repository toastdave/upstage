# Agent Resources

This directory is the agent-facing workflow hub for this repo.

- `references.md` lists the preferred docs, repo files, and implementation sources by domain
- `skills/` is reserved for local skill packs and copied guidance when needed
- `docs/prds/` remains the product source of truth for what to build

When multiple sources exist, use this order:

1. `docs/prds/` for product intent
2. Official docs and `llms.txt` files for library behavior
3. Local workflow notes in `.agents/` for repo-specific conventions

Use `.agents/` as supporting implementation guidance, not as a replacement for canonical product or library docs.
