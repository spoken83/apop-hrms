"use client";

import { useActionState } from "react";
import {
  addAdjustment,
  confirmPayrollRun,
  markCpfSubmitted,
  removeAdjustment,
} from "@/lib/actions-payroll";
import type { FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50 outline-none";

export function AdjustmentForm({
  runId,
  employmentOptions,
}: {
  runId: string;
  employmentOptions: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    addAdjustment.bind(null, runId),
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="adj-employment">Employee</Label>
        <select id="adj-employment" name="employmentId" className={selectClass}>
          {employmentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="adj-kind">Type</Label>
        <select id="adj-kind" name="kind" className={selectClass}>
          <option value="allowance">Allowance (OW)</option>
          <option value="bonus">Bonus (AW)</option>
          <option value="deduction">Deduction</option>
        </select>
      </div>
      <div className="w-32 space-y-1.5">
        <Label htmlFor="adj-amount">Amount</Label>
        <Input id="adj-amount" name="amount" type="number" step="0.01" min="0.01" className="font-mono" required />
      </div>
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="adj-reason">Reason (required)</Label>
        <Input id="adj-reason" name="reason" required />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Recomputing…" : "Add adjustment"}
      </Button>
      {state.errors?.form ? (
        <p className="w-full text-sm text-destructive">{state.errors.form}</p>
      ) : null}
    </form>
  );
}

export function RemoveAdjustmentButton({
  runId,
  adjustmentId,
}: {
  runId: string;
  adjustmentId: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      onClick={() => removeAdjustment(runId, adjustmentId)}
    >
      Remove
    </Button>
  );
}

export function ConfirmRunButton({
  runId,
  periodLabel,
  disabled,
}: {
  runId: string;
  periodLabel: string;
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    confirmPayrollRun.bind(null, runId),
    {},
  );

  return (
    <div className="flex items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={disabled || isPending}>
            {isPending ? "Confirming…" : "Confirm payroll"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payroll for {periodLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks the run. Amounts can no longer be edited — corrections
              after confirming require a supplementary run, matching how CPF
              amendments work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={formAction}>
              <AlertDialogAction type="submit">Confirm payroll</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.errors?.form ? (
        <p className="text-sm text-destructive">{state.errors.form}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-success">{state.message}</p>
      ) : null}
    </div>
  );
}

export function CpfSubmittedCheckbox({
  runId,
  submitted,
  deadline,
}: {
  runId: string;
  submitted: boolean;
  deadline: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={submitted}
        onCheckedChange={(checked) => markCpfSubmitted(runId, checked === true)}
      />
      Uploaded at cpf.gov.sg EZPay and paid — due {deadline}
    </label>
  );
}
