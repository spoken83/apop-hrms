import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, employments, entities, outlets } from "@/lib/db/schema";
import { ALL_ENTITIES, getSelectedEntityId } from "@/lib/entity-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const RESIDENCY_LABELS: Record<string, string> = {
  citizen: "Citizen",
  pr: "PR",
  wp: "WP",
  spass: "S Pass",
  ep: "EP",
};

export default async function PeoplePage() {
  const selectedEntity = await getSelectedEntityId();

  const rows = await db
    .select({
      employeeId: employees.id,
      fullName: employees.fullName,
      residencyStatus: employees.residencyStatus,
      entityName: entities.name,
      roleTitle: employments.roleTitle,
      employmentType: employments.employmentType,
      isScheduled: employments.isScheduled,
      outletName: outlets.name,
    })
    .from(employments)
    .innerJoin(employees, eq(employments.employeeId, employees.id))
    .innerJoin(entities, eq(employments.entityId, entities.id))
    .leftJoin(outlets, eq(employments.outletId, outlets.id))
    .where(
      and(
        isNull(employments.endDate),
        selectedEntity === ALL_ENTITIES
          ? undefined
          : eq(employments.entityId, selectedEntity),
      ),
    )
    .orderBy(asc(employees.fullName));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} active {rows.length === 1 ? "employee" : "employees"}
          </p>
        </div>
        <Button asChild>
          <Link href="/people/new">New employee</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No employees yet. Add your first employee to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Scheduled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.employeeId}>
                <TableCell>
                  <Link
                    href={`/people/${row.employeeId}`}
                    className="font-medium hover:underline"
                  >
                    {row.fullName}
                  </Link>
                </TableCell>
                <TableCell>{row.entityName}</TableCell>
                <TableCell>{row.roleTitle}</TableCell>
                <TableCell className="capitalize">{row.employmentType}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {RESIDENCY_LABELS[row.residencyStatus]}
                  </Badge>
                </TableCell>
                <TableCell>{row.outletName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.isScheduled ? "Yes" : "No"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
