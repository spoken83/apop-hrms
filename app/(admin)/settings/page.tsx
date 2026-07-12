import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, outlets } from "@/lib/db/schema";
import { EntitySettingsCard } from "@/components/entity-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [allEntities, allOutlets] = await Promise.all([
    db.select().from(entities).orderBy(asc(entities.createdAt)),
    db.select().from(outlets).orderBy(asc(outlets.name)),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Entities and outlets. Rate tables (CPF, SDL, SHG, FWL) arrive with
          the payroll engine in Phase 2.
        </p>
      </div>
      {allEntities.map((entity) => (
        <EntitySettingsCard
          key={entity.id}
          entity={entity}
          outlets={allOutlets.filter((o) => o.entityId === entity.id)}
        />
      ))}
    </div>
  );
}
