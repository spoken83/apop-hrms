"use client";

import { useFormStatus } from "react-dom";
import { startPayrollRun } from "@/lib/actions-payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Computing…" : "Run payroll"}
    </Button>
  );
}

export function StartRunForm({
  entityId,
  defaultMonth,
}: {
  entityId: string;
  defaultMonth: string;
}) {
  // The form posts straight to the server action, which computes the draft and
  // redirects. Native form submission — no client-side action dispatch to fail.
  return (
    <form action={startPayrollRun} className="flex items-end gap-2">
      <input type="hidden" name="entityId" value={entityId} />
      <div className="space-y-1.5">
        <Label htmlFor="periodMonth">Period</Label>
        <Input
          id="periodMonth"
          name="periodMonth"
          type="month"
          defaultValue={defaultMonth}
          required
        />
      </div>
      <SubmitButton />
    </form>
  );
}
