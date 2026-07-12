import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findBlockers,
  getPreviousRun,
  getRunDetail,
} from "@/lib/payroll/run-service";
import { cpfAgeBand } from "@/lib/payroll/age";
import { CPF_TABLES, resolveTable } from "@/lib/payroll/rate-tables";
import { formatCents } from "@/lib/payroll/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoneyCell } from "@/components/money-cell";
import {
  AdjustmentForm,
  ConfirmRunButton,
  CpfSubmittedCheckbox,
  RemoveAdjustmentButton,
} from "@/components/run-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function monthLabel(periodMonth: string): string {
  return new Date(`${periodMonth}-01T00:00:00`).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

function prevMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cpfDeadline(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  return formatDate(new Date(y, m, 14)); // 14th of following month
}

function Stepper({ status }: { status: "draft" | "confirmed" }) {
  const steps = ["Draft", "Review", "Done"];
  const activeIndex = status === "confirmed" ? 2 : 1;
  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          {i > 0 ? <span className="text-muted-foreground">→</span> : null}
          <span
            className={cn(
              "rounded-full px-3 py-1",
              i < activeIndex && "bg-muted text-muted-foreground",
              i === activeIndex &&
                (status === "confirmed"
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground"),
              i > activeIndex && "text-muted-foreground",
            )}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRunDetail(id);
  if (!run) notFound();

  const isDraft = run.status === "draft";
  const [blockers, previousRun] = await Promise.all([
    isDraft
      ? findBlockers(run.entityId, run.periodMonth)
      : Promise.resolve([]),
    getPreviousRun(run.entityId, run.periodMonth),
  ]);

  const cpfTable = resolveTable(CPF_TABLES, run.periodMonth);
  const prevNetByEmployment = new Map(
    previousRun?.payslips.map((p) => [p.employmentId, p.netCents]) ?? [],
  );

  // Exception-first review: flags carry icon + text, color is never the
  // only signal (UI spec §6, accessibility floor).
  const rows = run.payslips.map((p) => {
    const emp = p.employment.employee;
    const flags: string[] = [];
    const prevNet = prevNetByEmployment.get(p.employmentId);
    if (previousRun && prevNet === undefined) flags.push("First payroll");
    if (
      prevNet !== undefined &&
      prevNet > 0 &&
      Math.abs(p.netCents - prevNet) / prevNet > 0.1
    ) {
      flags.push(
        `Net ${p.netCents > prevNet ? "up" : "down"} ${Math.round(
          (Math.abs(p.netCents - prevNet) / prevNet) * 100,
        )}% vs ${monthLabel(previousRun!.periodMonth)}`,
      );
    }
    const isLocal =
      emp.residencyStatus === "citizen" || emp.residencyStatus === "pr";
    if (isLocal && p.grossCents > 0 && p.cpfEmployeeCents + p.cpfEmployerCents === 0) {
      flags.push("Zero CPF for citizen/PR — check data");
    }
    if (isLocal) {
      const bandNow = cpfAgeBand(cpfTable, emp.dob, run.periodMonth);
      const bandPrev = cpfAgeBand(cpfTable, emp.dob, prevMonth(run.periodMonth));
      if (bandNow.id !== bandPrev.id) {
        flags.push(`CPF band change this month (${bandPrev.label} → ${bandNow.label})`);
      }
    }
    if (p.ezpayStatus === "N") flags.push("New joiner");
    if (p.ezpayStatus === "L") flags.push("Leaver");
    if (p.ezpayStatus === "O") flags.push("Joined and left this month");
    return { payslip: p, employee: emp, flags };
  });

  const totals = run.payslips.reduce(
    (t, p) => ({
      gross: t.gross + p.grossCents,
      cpfEe: t.cpfEe + p.cpfEmployeeCents,
      cpfEr: t.cpfEr + p.cpfEmployerCents,
      sdl: t.sdl + p.sdlCents,
      shg: t.shg + p.shgCents,
      net: t.net + p.netCents,
    }),
    { gross: 0, cpfEe: 0, cpfEr: 0, sdl: 0, shg: 0, net: 0 },
  );

  const lineByType = (payslipId: string, type: string) =>
    run.payslips
      .find((p) => p.id === payslipId)
      ?.lines.find((l) => l.lineType === type);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payroll — {monthLabel(run.periodMonth)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {run.entity.name} · {run.payslips.length} employees · rate tables:{" "}
            <span className="font-mono">
              {Object.values(run.rateTableVersions).join(", ") || "—"}
            </span>
          </p>
        </div>
        <Stepper status={run.status} />
      </div>

      {isDraft && blockers.length > 0 ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              {blockers.length} blocking issue{blockers.length > 1 ? "s" : ""} —
              fix before confirming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {blockers.map((b, i) => (
                <li key={i}>
                  <span className="font-medium">{b.name}</span>: {b.reason}{" "}
                  <Link href={`/people`} className="text-primary underline">
                    Fix
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">CPF (EE)</TableHead>
            <TableHead className="text-right">SHG</TableHead>
            <TableHead className="text-right">Net pay</TableHead>
            <TableHead className="text-right">CPF (ER)</TableHead>
            <TableHead className="text-right">SDL</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ payslip: p, employee, flags }) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link
                  href={`/payslips/${p.id}`}
                  className="font-medium hover:underline"
                  target="_blank"
                >
                  {employee.fullName}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.grossCents}
                  trace={lineByType(p.id, "basic")?.trace as never}
                />
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.cpfEmployeeCents}
                  trace={lineByType(p.id, "cpf_ee")?.trace as never}
                />
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.shgCents}
                  trace={
                    (p.shgFund &&
                      lineByType(p.id, `shg_${p.shgFund}`)?.trace) as never
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.netCents}
                  trace={lineByType(p.id, "net_pay")?.trace as never}
                  className="font-medium"
                />
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.cpfEmployerCents}
                  trace={lineByType(p.id, "cpf_er")?.trace as never}
                />
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell
                  amountCents={p.sdlCents}
                  trace={lineByType(p.id, "sdl")?.trace as never}
                />
              </TableCell>
              <TableCell>
                <div className="flex max-w-56 flex-wrap gap-1">
                  {flags.map((f) => (
                    <Badge
                      key={f}
                      className="bg-warning text-warning-foreground"
                    >
                      ⚠ {f}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-medium">
            <TableCell>Total</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.gross)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.cpfEe)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.shg)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.net)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.cpfEr)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCents(totals.sdl)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>

      {isDraft ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adjustments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Corrections happen via adjustment lines with a reason — never
                by editing computed values. Allowances count as ordinary
                wages, bonuses as additional wages; CPF recomputes.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {run.adjustments.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {run.adjustments.map((a) => {
                    const emp = run.payslips.find(
                      (p) => p.employmentId === a.employmentId,
                    )?.employment.employee;
                    return (
                      <li key={a.id} className="flex items-center gap-2">
                        <span className="font-medium">{emp?.fullName}</span>
                        <span className="capitalize">{a.kind}</span>
                        <span className="font-mono tabular-nums">
                          {formatCents(a.amountCents)}
                        </span>
                        <span className="text-muted-foreground">— {a.reason}</span>
                        <RemoveAdjustmentButton runId={run.id} adjustmentId={a.id} />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <AdjustmentForm
                runId={run.id}
                employmentOptions={run.payslips.map((p) => ({
                  id: p.employmentId,
                  name: p.employment.employee.fullName,
                }))}
              />
            </CardContent>
          </Card>

          <ConfirmRunButton
            runId={run.id}
            periodLabel={monthLabel(run.periodMonth)}
            disabled={blockers.length > 0 || run.payslips.length === 0}
          />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outputs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirmed {run.confirmedAt ? formatDate(run.confirmedAt) : ""}. Run
              is locked — corrections require a supplementary run.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline">
                <a href={`/payroll/${run.id}/ezpay`} download>
                  Download CPF EZPay file
                </a>
              </Button>
              <span className="text-sm text-muted-foreground">
                CPF {formatCents(totals.cpfEe + totals.cpfEr)} + SHG{" "}
                {formatCents(totals.shg)} + SDL {formatCents(totals.sdl)}
              </span>
            </div>
            <CpfSubmittedCheckbox
              runId={run.id}
              submitted={run.cpfSubmittedAt !== null}
              deadline={cpfDeadline(run.periodMonth)}
            />
            <div className="text-sm text-muted-foreground">
              Payslips: open any employee row above (opens in a new tab, use
              the browser&apos;s Print → Save as PDF until the ESS portal ships in
              Phase 6). OCBC payment file arrives in Phase 4.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
