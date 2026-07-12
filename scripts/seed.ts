import { db } from "../lib/db";
import { entities, rateTables } from "../lib/db/schema";
import {
  CPF_TABLES,
  SDL_TABLES,
  SHG_TABLES,
} from "../lib/payroll/rate-tables";

// Entities per build plan §2. UEN/CSN for 11 Coffeehive and PFA are TBC
// until incorporation — fill in via Settings when known.
const seedEntities = [
  { name: "APOP", sector: "services", bankName: "OCBC" },
  { name: "11 Coffeehive", sector: "services" },
  { name: "PFA", sector: "services" },
];

async function main() {
  for (const entity of seedEntities) {
    const existing = await db.query.entities.findFirst({
      where: (t, { eq }) => eq(t.name, entity.name),
    });
    if (existing) {
      console.log(`Entity "${entity.name}" already exists, skipping`);
      continue;
    }
    await db.insert(entities).values(entity);
    console.log(`Seeded entity "${entity.name}"`);
  }

  // Rate tables: versioned by effective date, keyed on (type, effectiveFrom).
  const allTables = [
    ...CPF_TABLES.map((t) => ({ tableType: "cpf" as const, ...t })),
    ...SDL_TABLES.map((t) => ({ tableType: "sdl" as const, ...t })),
    ...SHG_TABLES.map((t) => ({ tableType: "shg" as const, ...t })),
  ];
  for (const t of allTables) {
    const existing = await db.query.rateTables.findFirst({
      where: (tbl, { and, eq }) =>
        and(eq(tbl.tableType, t.tableType), eq(tbl.effectiveFrom, t.effectiveFrom)),
    });
    if (existing) {
      console.log(`Rate table ${t.tableType}@${t.effectiveFrom} already exists, skipping`);
      continue;
    }
    await db.insert(rateTables).values({
      tableType: t.tableType,
      effectiveFrom: t.effectiveFrom,
      payload: t.payload,
    });
    console.log(`Seeded rate table ${t.tableType}@${t.effectiveFrom}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
