import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  employees,
  employments,
  payrollRuns,
  payslipLines,
  payslips,
  runAdjustments,
} from "../db/schema";
import {
  CPF_TABLES,
  SDL_TABLES,
  SHG_TABLES,
  resolveTable,
} from "./rate-tables";
import { computePayslip } from "./run-compute";
import { toCents, type Cents } from "./money";

export type RunBlocker = { employmentId: string; name: string; reason: string };

function monthEnd(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  return `${periodMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

// Employments active at any point in the period for this entity.
async function activeEmployments(entityId: string, periodMonth: string) {
  return db.query.employments.findMany({
    where: and(
      eq(employments.entityId, entityId),
      lte(employments.startDate, monthEnd(periodMonth)),
      or(
        isNull(employments.endDate),
        gte(employments.endDate, `${periodMonth}-01`),
      ),
    ),
    with: { employee: true },
  });
}

// Blocking issues per UI spec §4.4: no entering review with blockers.
export async function findBlockers(
  entityId: string,
  periodMonth: string,
): Promise<RunBlocker[]> {
  const active = await activeEmployments(entityId, periodMonth);
  const blockers: RunBlocker[] = [];
  for (const emp of active) {
    if (emp.employmentType === "hourly") {
      blockers.push({
        employmentId: emp.id,
        name: emp.employee.fullName,
        reason:
          "Hourly-paid: needs confirmed timesheets (Phase 5). Remove from this run by ending the employment or wait for timesheets.",
      });
    } else if (!emp.baseSalary || Number(emp.baseSalary) <= 0) {
      blockers.push({
        employmentId: emp.id,
        name: emp.employee.fullName,
        reason: "Missing monthly salary on the employment record.",
      });
    }
    if (!emp.employee.bankAccountNo) {
      blockers.push({
        employmentId: emp.id,
        name: emp.employee.fullName,
        reason: "Missing bank account number (needed for payment).",
      });
    }
  }
  return blockers;
}

// YTD figures per employee at this entity from prior CONFIRMED runs this year.
async function ytdFigures(
  entityId: string,
  employeeId: string,
  periodMonth: string,
): Promise<{ owSubjectCents: Cents; awSubjectCents: Cents; contributionsCents: Cents }> {
  const year = periodMonth.slice(0, 4);
  const rows = await db
    .select({
      ow: sql<number>`coalesce(sum(${payslips.owSubjectCents}), 0)`,
      aw: sql<number>`coalesce(sum(${payslips.awSubjectCents}), 0)`,
      cpf: sql<number>`coalesce(sum(${payslips.cpfEmployeeCents} + ${payslips.cpfEmployerCents}), 0)`,
    })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payslips.runId, payrollRuns.id))
    .innerJoin(employments, eq(payslips.employmentId, employments.id))
    .where(
      and(
        eq(payrollRuns.entityId, entityId),
        eq(payrollRuns.status, "confirmed"),
        gte(payrollRuns.periodMonth, `${year}-01`),
        lt(payrollRuns.periodMonth, periodMonth),
        eq(employments.employeeId, employeeId),
      ),
    );
  const r = rows[0];
  return {
    owSubjectCents: Number(r?.ow ?? 0),
    awSubjectCents: Number(r?.aw ?? 0),
    contributionsCents: Number(r?.cpf ?? 0),
  };
}

async function computeAndInsertPayslips(runId: string) {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
    with: { adjustments: true },
  });
  if (!run) throw new Error("Run not found");
  if (run.status !== "draft") throw new Error("Run is locked");

  const tables = {
    cpf: resolveTable(CPF_TABLES, run.periodMonth),
    sdl: resolveTable(SDL_TABLES, run.periodMonth),
    shg: resolveTable(SHG_TABLES, run.periodMonth),
  };

  const active = (await activeEmployments(run.entityId, run.periodMonth)).filter(
    (e) => e.employmentType === "monthly" && e.baseSalary,
  );

  // Wipe and recompute (draft only) so adjustments always flow through CPF.
  const existing = await db
    .select({ id: payslips.id })
    .from(payslips)
    .where(eq(payslips.runId, runId));
  if (existing.length) {
    await db.delete(payslipLines).where(
      inArray(payslipLines.payslipId, existing.map((p) => p.id)),
    );
    await db.delete(payslips).where(eq(payslips.runId, runId));
  }

  for (const emp of active) {
    const ytd = await ytdFigures(run.entityId, emp.employeeId, run.periodMonth);
    const adjustments = run.adjustments
      .filter((a) => a.employmentId === emp.id)
      .map((a) => ({ kind: a.kind, amountCents: a.amountCents, reason: a.reason }));

    const result = computePayslip({
      periodMonth: run.periodMonth,
      employment: {
        startDate: emp.startDate,
        endDate: emp.endDate,
        baseSalaryCents: toCents(emp.baseSalary!),
      },
      employee: {
        dob: emp.employee.dob,
        residencyStatus: emp.employee.residencyStatus,
        race: emp.employee.race,
        shgOptOut: emp.employee.shgOptOut,
      },
      adjustments,
      ytd,
      tables,
    });

    const [slip] = await db
      .insert(payslips)
      .values({
        runId,
        employmentId: emp.id,
        owCents: result.owCents,
        awCents: result.awCents,
        owSubjectCents: result.owSubjectCents,
        awSubjectCents: result.awSubjectCents,
        grossCents: result.grossCents,
        cpfEmployeeCents: result.cpfEmployeeCents,
        cpfEmployerCents: result.cpfEmployerCents,
        sdlCents: result.sdlCents,
        shgFund: result.shgFund,
        shgCents: result.shgCents,
        netCents: result.netCents,
        ezpayStatus: result.ezpayStatus,
      })
      .returning({ id: payslips.id });

    await db.insert(payslipLines).values(
      result.lines.map((line, i) => ({
        payslipId: slip.id,
        lineType: line.lineType,
        label: line.label,
        amountCents: line.amountCents,
        trace: line.trace ?? null,
        sortOrder: i,
      })),
    );
  }

  await db
    .update(payrollRuns)
    .set({
      rateTableVersions: {
        cpf: tables.cpf.version,
        sdl: tables.sdl.version,
        shg: tables.shg.version,
      },
    })
    .where(eq(payrollRuns.id, runId));
}

export async function createDraftRun(
  entityId: string,
  periodMonth: string,
): Promise<string> {
  const existing = await db.query.payrollRuns.findFirst({
    where: and(
      eq(payrollRuns.entityId, entityId),
      eq(payrollRuns.periodMonth, periodMonth),
    ),
  });
  if (existing) return existing.id;

  const priorRuns = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(eq(payrollRuns.entityId, entityId));
  const adviceCode = String((priorRuns.length % 99) + 1).padStart(2, "0");

  const [run] = await db
    .insert(payrollRuns)
    .values({ entityId, periodMonth, adviceCode })
    .returning({ id: payrollRuns.id });

  await computeAndInsertPayslips(run.id);
  return run.id;
}

export async function recomputeDraftRun(runId: string) {
  await computeAndInsertPayslips(runId);
}

export async function getRunDetail(runId: string) {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
    with: {
      entity: true,
      adjustments: true,
      payslips: {
        with: {
          employment: { with: { employee: true } },
          lines: { orderBy: [asc(payslipLines.sortOrder)] },
        },
      },
    },
  });
  if (!run) return null;
  run.payslips.sort((a, b) =>
    a.employment.employee.fullName.localeCompare(b.employment.employee.fullName),
  );
  return run;
}

// Previous confirmed run for delta flags in review.
export async function getPreviousRun(entityId: string, periodMonth: string) {
  const prev = await db.query.payrollRuns.findMany({
    where: and(
      eq(payrollRuns.entityId, entityId),
      eq(payrollRuns.status, "confirmed"),
      lt(payrollRuns.periodMonth, periodMonth),
    ),
    with: { payslips: { with: { employment: true } } },
    orderBy: (t, { desc }) => [desc(t.periodMonth)],
    limit: 1,
  });
  return prev[0] ?? null;
}

export async function getEmployeeAccountRows(runId: string) {
  const run = await getRunDetail(runId);
  if (!run) throw new Error("Run not found");
  return run.payslips.map((p) => ({
    accountNo: p.employment.employee.idNumber,
    name: p.employment.employee.fullName,
    cpfTotalCents: p.cpfEmployeeCents + p.cpfEmployerCents,
    owCents: p.owCents,
    awCents: p.awCents,
    employmentStatus: p.ezpayStatus as "E" | "L" | "N" | "O",
    shg:
      p.shgFund && p.shgCents > 0
        ? {
            fund: p.shgFund as "cdac" | "sinda" | "mbmf" | "ecf",
            amountCents: p.shgCents,
          }
        : undefined,
  }));
}
