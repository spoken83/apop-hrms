import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, payrollRuns } from "@/lib/db/schema";
import { ALL_ENTITIES, getSelectedEntityId } from "@/lib/entity-context";
import { formatCents } from "@/lib/payroll/money";
import { StartRunForm } from "@/components/start-run-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sql } from "drizzle-orm";
import { employments, payslips } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function monthLabel(periodMonth: string): string {
  return new Date(`${periodMonth}-01T00:00:00`).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

export default async function PayrollPage() {
  const selectedEntity = await getSelectedEntityId();

  // Payroll is always run for one entity. When no specific entity is in scope,
  // let the user choose right here instead of sending them to the sidebar.
  if (selectedEntity === ALL_ENTITIES) {
    const allEntities = await db
      .select({
        id: entities.id,
        name: entities.name,
        headcount: sql<number>`(select count(*) from ${employments} where ${employments.entityId} = ${entities.id} and ${employments.endDate} is null)`,
      })
      .from(entities)
      .orderBy(entities.createdAt);

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Choose an entity to run or review its payroll.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {allEntities.map((e) => (
            <a
              key={e.id}
              href={`/entity/set?id=${e.id}&next=/payroll`}
              className="group rounded-lg border p-5 transition-colors hover:border-ring hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-medium">{e.name}</span>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {Number(e.headcount)}{" "}
                {Number(e.headcount) === 1 ? "active employee" : "active employees"}
              </p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  const [entity, runs] = await Promise.all([
    db.query.entities.findFirst({ where: eq(entities.id, selectedEntity) }),
    db
      .select({
        id: payrollRuns.id,
        periodMonth: payrollRuns.periodMonth,
        status: payrollRuns.status,
        cpfSubmittedAt: payrollRuns.cpfSubmittedAt,
        headcount: sql<number>`(select count(*) from ${payslips} where ${payslips.runId} = ${payrollRuns.id})`,
        netTotal: sql<number>`(select coalesce(sum(${payslips.netCents}),0) from ${payslips} where ${payslips.runId} = ${payrollRuns.id})`,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.entityId, selectedEntity))
      .orderBy(desc(payrollRuns.periodMonth)),
  ]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">{entity?.name}</p>
        </div>
        <StartRunForm entityId={selectedEntity} defaultMonth={currentMonth} />
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Run your first payroll for {monthLabel(currentMonth)}.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead className="text-right">Net total</TableHead>
              <TableHead>CPF submission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link href={`/payroll/${run.id}`} className="font-medium hover:underline">
                    {monthLabel(run.periodMonth)}
                  </Link>
                </TableCell>
                <TableCell>
                  {run.status === "draft" ? (
                    <Badge className="bg-warning text-warning-foreground">Draft</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground">Confirmed</Badge>
                  )}
                </TableCell>
                <TableCell>{run.headcount}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(Number(run.netTotal))}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {run.status !== "confirmed"
                    ? "—"
                    : run.cpfSubmittedAt
                      ? "Submitted"
                      : "Not yet submitted"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
