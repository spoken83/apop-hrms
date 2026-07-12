import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, outlets } from "@/lib/db/schema";
import { NewEmployeeForm } from "@/components/new-employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const [allEntities, allOutlets] = await Promise.all([
    db.select().from(entities).orderBy(asc(entities.createdAt)),
    db.select().from(outlets).orderBy(asc(outlets.name)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New employee</h1>
        <p className="text-sm text-muted-foreground">
          Personal details, then employment. Statutory treatment is derived
          automatically — check the profile after creating.
        </p>
      </div>
      <NewEmployeeForm
        entities={allEntities.map(({ id, name }) => ({ id, name }))}
        outlets={allOutlets.map(({ id, name, entityId }) => ({
          id,
          name,
          entityId,
        }))}
      />
    </div>
  );
}
