import Link from "next/link";
import { count, desc, eq, isNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, employments, payrollRuns, payslips } from "@/lib/db/schema";
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
    // Active headcount per entity via a grouped aggregate, then merged in JS.
    // (A correlated subquery in the select clause does not qualify columns
    // and silently miscounts — use an explicit group-by instead.)
    const [entityRows, counts] = await Promise.all([
      db
        .select({ id: entities.id, name: entities.name })
        .from(entities)
        .orderBy(entities.createdAt),
      db
        .select({
          entityId: employments.entityId,
          n: count(),
        })
        .from(employments)
        .where(isNull(employments.endDate))
        .groupBy(employments.entityId),
    ]);
    const countByEntity = new Map(counts.map((c) => [c.entityId, c.n]));
    const allEntities = entityRows.map((e) => ({
      ...e,
      headcount: countByEntity.get(e.id) ?? 0,
    }));

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

  // Per-run headcount and net total via a left join + group by, so each run's
  // aggregates come straight from its payslips (runs with no payslips read 0).
  const [entity, runs] = await Promise.all([
    db.query.entities.findFirst({ where: eq(entities.id, selectedEntity) }),
    db
      .select({
        id: payrollRuns.id,
        periodMonth: payrollRuns.periodMonth,
        status: payrollRuns.status,
        cpfSubmittedAt: payrollRuns.cpfSubmittedAt,
        headcount: count(payslips.id),
        netTotal: sql<number>`coalesce(${sum(payslips.netCents)}, 0)`,
      })
      .from(payrollRuns)
      .leftJoin(payslips, eq(payslips.runId, payrollRuns.id))
      .where(eq(payrollRuns.entityId, selectedEntity))
      .groupBy(payrollRuns.id)
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
