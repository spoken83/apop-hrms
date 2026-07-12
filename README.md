# APOP HRMS

Internal HRMS for APOP group entities (APOP, 11 Coffeehive, PFA). Singapore
payroll: CPF, SDL, SHG, FWL, CPF EZPay file generation, OCBC payments.

Source-of-truth plan docs live in the Obsidian vault under
`APOP Digital/HRMS/` (Build Plan + UI/UX Spec).

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Drizzle ORM ·
Postgres (Neon in production, OrbStack container locally) · Vercel

## Local development

Everything runs in OrbStack containers — app (Node 22) and Postgres 17:

```bash
cp .env.example .env       # local defaults work as-is
docker compose up -d
docker compose logs -f app # watch the dev server
```

App: **http://apop-hrms.orb.local** · Postgres: `apop-hrms-db.orb.local:5432`

No host ports are published — OrbStack container domains route directly to
each container, so multiple projects can run side by side without port
conflicts. The app container installs its own (Linux) `node_modules` in a
named volume and hot-reloads from the bind-mounted source. Inside the compose
network the app reaches the db at `db:5432`; host-side tools (drizzle-kit,
seeds) use the `apop-hrms-db.orb.local` URL from `.env`.

Database setup and host-side tooling still need Node 22 locally (`nvm use`):

```bash
npm install                # host node_modules for tooling/editor
npm run db:migrate         # apply migrations
npm run db:seed            # seed the three entities
```

## Database

- Schema: `lib/db/schema.ts` (Drizzle)
- `npm run db:generate` — generate a migration after schema changes
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — browse data

Key model decision: `employees` (the person) is separate from `employments`
(assignment to an entity with effective dates). An entity transfer closes the
old employment and opens a new one — never edit in place.

## Build phases

1. ✅ Foundation — entities, employees, employments, outlets, admin CRUD
2. CPF engine (pure calc module + versioned rate tables)
3. Payroll runs + payslips + CPF EZPay file
4. OCBC Velocity payment file
5. Roster + timesheets
6. ESS portal + leave
7. Xero journals
8. IR8A (Dec 2026)
