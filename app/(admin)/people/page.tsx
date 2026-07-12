import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, employments, entities, outlets } from "@/lib/db/schema";
import { ALL_ENTITIES, getSelectedEntityId } from "@/lib/entity-context";
import { formatSGD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

const RESIDENCY_LABELS: Record<string, string> = {
  citizen: "Citizen",
  pr: "PR",
  wp: "WP",
  spass: "S Pass",
  ep: "EP",
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ view }, selectedEntity] = await Promise.all([
    searchParams,
    getSelectedEntityId(),
  ]);
  const isCards = view === "cards";

  const rows = await db
    .select({
      employeeId: employees.id,
      fullName: employees.fullName,
      residencyStatus: employees.residencyStatus,
      entityName: entities.name,
      roleTitle: employments.roleTitle,
      employmentType: employments.employmentType,
      baseSalary: employments.baseSalary,
      hourlyRate: employments.hourlyRate,
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
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border p-0.5">
            <Link
              href="/people"
              className={cn(
                "rounded px-3 py-1 text-sm",
                !isCards
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              List
            </Link>
            <Link
              href="/people?view=cards"
              className={cn(
                "rounded px-3 py-1 text-sm",
                isCards
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Cards
            </Link>
          </div>
          <Button asChild>
            <Link href="/people/new">New employee</Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No employees yet. Add your first employee to get started.
        </div>
      ) : isCards ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {rows.map((row) => (
            <Link key={row.employeeId} href={`/people/${row.employeeId}`}>
              <Card className="h-full transition-colors hover:border-ring">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{row.fullName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {row.roleTitle} · {row.entityName}
                    {row.outletName ? ` · ${row.outletName}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <Badge variant="secondary">
                      {RESIDENCY_LABELS[row.residencyStatus]}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {row.employmentType}
                    </Badge>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {row.employmentType === "monthly"
                      ? `${formatSGD(row.baseSalary)}/mo`
                      : `${formatSGD(row.hourlyRate)}/hr`}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
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
