"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { payrollRuns, runAdjustments } from "./db/schema";
import {
  createDraftRun,
  findBlockers,
  recomputeDraftRun,
} from "./payroll/run-service";
import type { FormState } from "./actions";

// Invoked directly as a <form action>, so Next handles the redirect natively
// (progressive enhancement — works even if client JS never hydrates).
export async function startPayrollRun(formData: FormData): Promise<void> {
  const entityId = String(formData.get("entityId") ?? "");
  const periodMonth = String(formData.get("periodMonth") ?? "");
  if (!entityId || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    redirect("/payroll");
  }
  const runId = await createDraftRun(entityId, periodMonth);
  revalidatePath("/payroll");
  redirect(`/payroll/${runId}`);
}

export async function addAdjustment(
  runId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
  });
  if (!run || run.status !== "draft") {
    return { errors: { form: "Run is locked" } };
  }

  const employmentId = String(formData.get("employmentId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!employmentId || !["allowance", "bonus", "deduction"].includes(kind)) {
    return { errors: { form: "Pick an employee and adjustment type" } };
  }
  if (!(amount > 0)) {
    return { errors: { form: "Amount must be positive (use type Deduction to subtract)" } };
  }
  if (!reason) {
    return { errors: { form: "A reason is required for every adjustment" } };
  }

  await db.insert(runAdjustments).values({
    runId,
    employmentId,
    kind: kind as "allowance" | "bonus" | "deduction",
    amountCents: Math.round(amount * 100),
    reason,
  });
  await recomputeDraftRun(runId);
  revalidatePath(`/payroll/${runId}`);
  return { message: "Adjustment added" };
}

export async function removeAdjustment(runId: string, adjustmentId: string) {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
  });
  if (!run || run.status !== "draft") return;
  await db
    .delete(runAdjustments)
    .where(and(eq(runAdjustments.id, adjustmentId), eq(runAdjustments.runId, runId)));
  await recomputeDraftRun(runId);
  revalidatePath(`/payroll/${runId}`);
}

export async function refreshDraftRun(runId: string) {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
  });
  if (!run || run.status !== "draft") return;
  await recomputeDraftRun(runId);
  revalidatePath(`/payroll/${runId}`);
}

export async function confirmPayrollRun(
  runId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
  });
  if (!run) return { errors: { form: "Run not found" } };
  if (run.status !== "draft") return { errors: { form: "Run already confirmed" } };

  const blockers = await findBlockers(run.entityId, run.periodMonth);
  if (blockers.length > 0) {
    return {
      errors: {
        form: `Cannot confirm with ${blockers.length} blocking issue(s). Fix them first.`,
      },
    };
  }

  // Recompute one final time so the locked numbers reflect current data,
  // then lock. Corrections after this = a supplementary run (like CPF
  // amendments work), never an edit.
  await recomputeDraftRun(runId);
  await db
    .update(payrollRuns)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(payrollRuns.id, runId));

  revalidatePath(`/payroll/${runId}`);
  revalidatePath("/payroll");
  return { message: "Payroll confirmed" };
}

export async function markCpfSubmitted(runId: string, submitted: boolean) {
  await db
    .update(payrollRuns)
    .set({ cpfSubmittedAt: submitted ? new Date() : null })
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.status, "confirmed")));
  revalidatePath(`/payroll/${runId}`);
}
