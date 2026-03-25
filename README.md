# Ghoomo

Starter monorepo for the Ghumo project with separate `frontend`, `backend`, and `database` workspaces.

## Current MVP scope

- tourist and guide registration/login
- frontend guide registration page
- verified guide listing
- admin guide approve/reject review flow
- booking creation and booking status updates
- PostgreSQL schema for users, guide profiles, bookings, itineraries, and reviews
- landing page, city coverage section, and guide directory connected to the backend
- frontend login page with admin redirect and protected `/admin` route

## Project structure

```text
frontend/   Next.js app
backend/    NestJS API
database/   Prisma schema, migrations, and seed
```

## Local run

```bash
pnpm db:up
pnpm db:generate
pnpm --filter @ghoomo/db exec prisma migrate dev --schema prisma/schema.prisma --name init
pnpm db:seed
pnpm --filter @ghoomo/api dev
pnpm --filter @ghoomo/web dev
```

## Demo accounts

- `admin@ghoomo.dev` / `demo12345`
- `anita.guide@ghoomo.dev` / `demo12345`
- `sameer.guide@ghoomo.dev` / `demo12345`
- `tourist@ghoomo.dev` / `demo12345`

## Frontend routes

- `/login` for seeded account sign-in
- `/admin` for admin-only frontend access
- `/guides` for the public guide directory
- `/guides/register` for guide onboarding

## Deferred from the report

- payment gateway
- real-time tracking
- admin dashboard workflows
- itinerary approval UI
