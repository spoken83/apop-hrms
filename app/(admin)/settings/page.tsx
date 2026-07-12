import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, outlets, rateTables } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { EntitySettingsCard } from "@/components/entity-settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [allEntities, allOutlets, allRateTables] = await Promise.all([
    db.select().from(entities).orderBy(asc(entities.createdAt)),
    db.select().from(outlets).orderBy(asc(outlets.name)),
    db
      .select()
      .from(rateTables)
      .orderBy(asc(rateTables.tableType), asc(rateTables.effectiveFrom)),
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statutory rate tables</CardTitle>
          <p className="text-sm text-muted-foreground">
            Read-only. Table updates ship as code and seed changes; payroll
            runs record which version they used. Review every Budget and every
            1 Jan — CPF 55–65 rates rise on 1 Jan 2027.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead>Effective to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRateTables.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="uppercase">{t.tableType}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {(t.payload as { version?: string }).version ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(t.effectiveFrom)}</TableCell>
                  <TableCell>
                    {t.effectiveTo ? (
                      formatDate(t.effectiveTo)
                    ) : (
                      <Badge className="bg-success text-success-foreground">
                        Current
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
