# Authentication And Accounts

## Goal

Enable secure sign-up, sign-in, session handling, and account settings for agents, hosts, photographers, and designers using Upstage.

## MVP scope

- Email and password authentication through Better Auth
- Session persistence and protected routes
- Basic account settings for name, avatar, and billing profile placeholders
- Upgrade-safe account model for future social login and team access

## User stories

- As an agent, I can create an account so I can save projects and purchase credits.
- As a designer, I can return to past projects and continue iterations.
- As a team lead, I can later invite collaborators without rebuilding auth.

## Task breakdown

- Add Better Auth server integration and environment wiring.
- Create auth routes for sign-up, sign-in, sign-out, and password reset placeholders.
- Add protected route handling for account and future dashboard routes.
- Persist sessions in Postgres using Drizzle-managed tables.
- Build starter account settings and billing summary placeholders.
- Add audit-friendly logging for auth failures and account lifecycle events.

## Acceptance criteria

- Protected routes redirect anonymous users.
- Signed-in users can reach account settings and sign out cleanly.
- Auth tables and session records are queryable in Drizzle Studio.

## Non-goals

- Full multi-factor authentication
- Organization-wide RBAC in v1
