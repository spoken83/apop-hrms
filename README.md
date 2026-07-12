# APOP HRMS

Internal HRMS for APOP group entities (APOP, 11 Coffeehive, PFA). Singapore
payroll: CPF, SDL, SHG, FWL, CPF EZPay file generation, OCBC payments.

Source-of-truth plan docs live in the Obsidian vault under
`APOP Digital/HRMS/` (Build Plan + UI/UX Spec).

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Drizzle ORM ·
Postgres (Neon in production, OrbStack container locally) · Vercel

## Local development

Requires Node 22 (`nvm use`) and OrbStack.

```bash
docker compose up -d       # Postgres 17 on localhost:5433
cp .env.example .env       # local defaults work as-is
npm install
npm run db:migrate         # apply migrations
npm run db:seed            # seed the three entities
npm run dev
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
