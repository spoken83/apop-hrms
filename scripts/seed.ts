import { db } from "../lib/db";
import { entities } from "../lib/db/schema";

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
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
